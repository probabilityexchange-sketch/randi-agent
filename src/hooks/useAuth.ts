"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { fetchApi } from "@/lib/utils/api";

const DEFAULT_RETRY_DELAY_MS = 3000;
const PRIVY_RATE_LIMIT_RETRY_MS = 15000;
const FINALIZE_TIMEOUT_MS = 12000;
const MAX_SYNC_ATTEMPTS = 3;

// Module-level deduplication — prevents multiple hook instances from firing
// concurrent requests. But we also maintain React state so re-renders fire
// when the state changes.
let sharedSessionSynced = false;
let sharedSyncPromise: Promise<void> | null = null;
let sharedNextRetryAt = 0;
let sharedSyncAttempts = 0;

// Subscribers that need to be notified when sharedSessionSynced flips to true
const syncedListeners = new Set<() => void>();

function notifySynced() {
  syncedListeners.forEach((fn) => fn());
}

function resetSharedState() {
  sharedSessionSynced = false;
  sharedSyncPromise = null;
  sharedNextRetryAt = 0;
  sharedSyncAttempts = 0;
}

class SessionSyncError extends Error {
  code: string | null;
  retryAfterMs: number | null;

  constructor(message: string, code: string | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.name = "SessionSyncError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return null;
}

function normalizeSyncError(error: unknown): SessionSyncError {
  if (error instanceof SessionSyncError) return error;
  if (error instanceof Error) return new SessionSyncError(error.message);
  return new SessionSyncError("Failed to establish server session");
}

export function useAuth() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const privy = usePrivy();
  const { ready, authenticated, user, login, logout, getAccessToken } = privy;

  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Reactive mirror of sharedSessionSynced so components re-render on change
  const [sessionSynced, setSessionSynced] = useState(sharedSessionSynced);
  const retryTimerRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);

  // Subscribe this hook instance to synced notifications
  useEffect(() => {
    const listener = () => setSessionSynced(true);
    syncedListeners.add(listener);
    // If already synced by the time we mount, apply immediately
    if (sharedSessionSynced) setSessionSynced(true);
    return () => { syncedListeners.delete(listener); };
  }, []);

  // Use linked accounts to find the primary Solana wallet
  const primaryWallet = useMemo(() => {
    if (!user) return null;
    if (user.wallet && (user.wallet as { chainType?: string }).chainType === "solana") {
      return user.wallet as { address: string };
    }
    return user.linkedAccounts?.find(
      (acc) => acc.type === "wallet" && (acc as { chainType?: string }).chainType === "solana"
    ) as { address: string } | undefined;
  }, [user]);

  const syncSession = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Missing Privy access token");

    const response = await fetchApi("/api/auth/privy-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({
        wallet: primaryWallet?.address || user?.wallet?.address,
      }),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => null) as
        | { code?: string; error?: string }
        | null;
      const code = details?.code || null;
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const defaultRetry =
        response.status === 429 || code === "privy_rate_limited"
          ? PRIVY_RATE_LIMIT_RETRY_MS
          : DEFAULT_RETRY_DELAY_MS;

      throw new SessionSyncError(
        details?.error || "Failed to establish server session",
        code,
        retryAfterMs ?? defaultRetry
      );
    }
  }, [getAccessToken, primaryWallet?.address, user?.wallet?.address]);

  const hasServerSession = useCallback(async () => {
    try {
      const response = await fetchApi("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const ensureServerSession = useCallback(async () => {
    // Check if we already have a valid cookie-based session
    const existingSession = await hasServerSession();
    if (existingSession) {
      sharedSessionSynced = true;
      sharedNextRetryAt = 0;
      sharedSyncAttempts = 0;
      notifySynced(); // triggers re-render in all hook instances
      return;
    }

    // Guard against infinite retries
    sharedSyncAttempts += 1;
    if (sharedSyncAttempts > MAX_SYNC_ATTEMPTS) {
      resetSharedState();
      throw new SessionSyncError(
        "Unable to establish session. Please sign out and try again.",
        "max_attempts_exceeded",
        null
      );
    }

    await syncSession();

    // Small settle time to ensure browser state is stable
    await new Promise<void>((resolve) => window.setTimeout(resolve, 500));

    sharedSessionSynced = true;
    sharedNextRetryAt = 0;
    sharedSyncAttempts = 0;
    // Notify all hook instances — this triggers re-render via setSessionSynced
    notifySynced();
  }, [hasServerSession, syncSession]);

  // Finalization timeout — auto-surface retry after FINALIZE_TIMEOUT_MS
  useEffect(() => {
    if (!ready || !authenticated || sessionSynced) {
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      return;
    }

    finalizeTimerRef.current = window.setTimeout(() => {
      if (!sharedSessionSynced) {
        setSessionError("Sign-in is taking longer than expected. Please retry.");
      }
    }, FINALIZE_TIMEOUT_MS);

    return () => {
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
    };
  }, [ready, authenticated, sessionSynced, syncRetryTick]);

  useEffect(() => {
    if (!ready || !authenticated || sessionSynced) return;

    let cancelled = false;
    const now = Date.now();
    if (now < sharedNextRetryAt) {
      const waitMs = Math.max(250, sharedNextRetryAt - now);
      retryTimerRef.current = window.setTimeout(() => {
        if (!cancelled) setSyncRetryTick((v) => v + 1);
      }, waitMs);

      return () => {
        cancelled = true;
        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      };
    }

    if (!sharedSyncPromise) {
      sharedSyncPromise = ensureServerSession()
        .catch((error) => {
          const normalized = normalizeSyncError(error);
          sharedSessionSynced = false;
          sharedNextRetryAt = Date.now() + (normalized.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS);
          throw normalized;
        })
        .finally(() => { sharedSyncPromise = null; });
    }

    sharedSyncPromise
      .then(() => { if (!cancelled) setSessionError(null); })
      .catch((error) => {
        if (cancelled) return;
        const normalized = normalizeSyncError(error);
        setSessionError(normalized.message);
        if (sharedSyncAttempts < MAX_SYNC_ATTEMPTS) {
          retryTimerRef.current = window.setTimeout(() => {
            setSyncRetryTick((v) => v + 1);
          }, Math.max(250, sharedNextRetryAt - Date.now()));
        }
        console.error("Failed to sync session", normalized);
      });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [ready, authenticated, ensureServerSession, syncRetryTick, sessionSynced]);

  useEffect(() => {
    if (!authenticated) {
      resetSharedState();
      setSessionSynced(false);
    }
  }, [authenticated]);

  const retrySessionSync = useCallback(() => {
    sharedNextRetryAt = 0;
    sharedSyncAttempts = 0;
    setSessionError(null);
    setSyncRetryTick((v) => v + 1);
  }, []);

  // sessionReady is now driven by reactive sessionSynced state, not the bare module bool
  const sessionReady = !authenticated || sessionSynced;

  const signIn = useCallback(async () => {
    if (authenticated) {
      if (!sessionSynced) {
        sharedNextRetryAt = 0;
        sharedSyncAttempts = 0;
        setSessionError(null);
        setSyncRetryTick((v) => v + 1);
      }
      return;
    }
    await login();
  }, [authenticated, sessionSynced, login]);

  return {
    user: user
      ? {
        id: user.id,
        walletAddress:
          user.wallet?.address ||
          primaryWallet?.address ||
          (user.linkedAccounts?.find(
            (account) =>
              account.type === "wallet" &&
              (account as { chainType?: string }).chainType === "solana"
          ) as { address?: string } | undefined)?.address,
      }
      : null,
    loading: !ready,
    isAuthenticated: authenticated,
    sessionReady,
    sessionError,
    retrySessionSync,
    signIn,
    signOut: async () => {
      // Clear shared state BEFORE Privy logout to prevent race
      resetSharedState();
      setSessionSynced(false);
      setSessionError(null);
      await fetchApi("/api/auth/logout", { method: "POST" }).catch(() => { });
      await logout();
    },
  };
}
