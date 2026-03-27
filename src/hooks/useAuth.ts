'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { fetchApi } from '@/lib/utils/api';

const DEFAULT_RETRY_DELAY_MS = 3000;
const PRIVY_RATE_LIMIT_RETRY_MS = 15000;
const FINALIZE_TIMEOUT_MS = 12000;
const SESSION_CONFIRM_TIMEOUT_MS = 5000;
const SESSION_CONFIRM_POLL_MS = 150;
const MAX_SYNC_ATTEMPTS = 3;

// Module-level deduplication — protects against multiple hook instances
let sharedSessionSynced = false;
let sharedSyncPromise: Promise<void> | null = null;
let sharedNextRetryAt = 0;
let sharedSyncAttempts = 0;
let isLoggingOutGlobal = false; // Prevents re-sync during logout process

const syncedListeners = new Set<() => void>();
function notifySynced() {
  syncedListeners.forEach(fn => fn());
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
    this.name = 'SessionSyncError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function normalizeSyncError(error: unknown): SessionSyncError {
  if (error instanceof SessionSyncError) return error;
  if (error instanceof Error) return new SessionSyncError(error.message);
  return new SessionSyncError('Failed to establish server session');
}

export function useAuth() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const privy = usePrivy();
  const { ready, authenticated, user, login, logout, getAccessToken } = privy;

  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionSynced, setSessionSynced] = useState(sharedSessionSynced);
  const [localIsLoggingOut, setLocalIsLoggingOut] = useState(false);
  const retryTimerRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const listener = () => setSessionSynced(true);
    syncedListeners.add(listener);
    if (sharedSessionSynced) setSessionSynced(true);
    return () => {
      syncedListeners.delete(listener);
    };
  }, []);

  const primaryWallet = useMemo(() => {
    if (!user) return null;
    if (user.wallet && (user.wallet as { chainType?: string }).chainType === 'solana') {
      return user.wallet as { address: string };
    }
    return user.linkedAccounts?.find(
      acc => acc.type === 'wallet' && (acc as { chainType?: string }).chainType === 'solana'
    ) as { address: string } | undefined;
  }, [user]);

  // Stable wallet address string — used to gate the sync so we never fire
  // syncSession with wallet: undefined before Privy finishes creating the
  // embedded wallet (which can trail authenticated=true by 100-500 ms).
  const walletAddress = useMemo(
    () => primaryWallet?.address || user?.wallet?.address || null,
    [primaryWallet?.address, user?.wallet?.address]
  );

  const syncSession = useCallback(async (): Promise<boolean> => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Missing Privy access token');

    const response = await fetchApi('/api/auth/privy-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        wallet: primaryWallet?.address || user?.wallet?.address,
      }),
    });

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      const code = details?.code || null;
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const defaultRetry =
        response.status === 429 || code === 'privy_rate_limited'
          ? PRIVY_RATE_LIMIT_RETRY_MS
          : DEFAULT_RETRY_DELAY_MS;
      throw new SessionSyncError(
        details?.error || 'Failed to establish server session',
        code,
        retryAfterMs ?? defaultRetry
      );
    }

    // If the server returned 200, the Set-Cookie header was sent.
    // Return true so callers can skip the confirmation poll —
    // the cookie may not be visible to subsequent requests immediately.
    return true;
  }, [getAccessToken, primaryWallet?.address, user?.wallet?.address]);

  const hasServerSession = useCallback(async () => {
    try {
      const response = await fetchApi('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      // CRITICAL: Ensure we didn't just get redirected to /login by middleware.
      if (!response.ok || response.redirected) return false;
      return true;
    } catch {
      return false;
    }
  }, []);

  const ensureServerSession = useCallback(async () => {
    if (isLoggingOutGlobal || localIsLoggingOut || sharedSessionSynced) return;

    // Check existing session first (e.g. page refresh with valid cookie)
    if (await hasServerSession()) {
      sharedSessionSynced = true;
      sharedNextRetryAt = 0;
      sharedSyncAttempts = 0;
      setSessionSynced(true);
      notifySynced();
      return;
    }

    if (sharedSyncAttempts >= MAX_SYNC_ATTEMPTS) {
      resetSharedState();
      throw new SessionSyncError(
        'Too many attempts. Sign out and try again.',
        'max_attempts_exceeded',
        null
      );
    }

    sharedSyncAttempts += 1;
    const serverConfirmed = await syncSession();

    if (!serverConfirmed) {
      throw new SessionSyncError("Failed to initiate server session.");
    }

    // After calling syncSession, the server has sent a Set-Cookie header.
    // However, the browser's cookie jar may not have committed the cookie yet.
    // We MUST verify that the cookie is actually visible to subsequent requests
    // by polling /api/auth/me before we mark the session as synced.
    //
    // If we mark it synced too early, the router will redirect to /dashboard,
    // and the middleware will see no cookie, redirecting the user back to /login.
    const confirmDeadline = Date.now() + SESSION_CONFIRM_TIMEOUT_MS;
    let pollCount = 0;
    while (!(await hasServerSession())) {
      pollCount++;
      if (Date.now() >= confirmDeadline) {
        throw new SessionSyncError(
          'Session was created but not yet visible to protected requests. Please retry.',
          'session_confirmation_timeout',
          DEFAULT_RETRY_DELAY_MS
        );
      }

      await new Promise<void>(resolve => window.setTimeout(resolve, SESSION_CONFIRM_POLL_MS));
    }

    // CRITICAL: Even after the first successful poll, give the browser one more
    // moment to settle. This "cooldown" significantly reduces race conditions
    // during fast client-side transitions.
    if (pollCount > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
    } else {
      // If it worked on the very first try, still give it a tiny bit of air
      await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
    }

    sharedSessionSynced = true;
    sharedNextRetryAt = 0;
    sharedSyncAttempts = 0;
    setSessionSynced(true);
    notifySynced();
  }, [hasServerSession, syncSession, localIsLoggingOut]);

  // finalizeTimer loop
  useEffect(() => {
    if (!ready || !authenticated || sessionSynced || localIsLoggingOut) {
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      return;
    }
    finalizeTimerRef.current = window.setTimeout(() => {
      if (!sharedSessionSynced) setSessionError('Sign-in is taking longer than expected...');
    }, FINALIZE_TIMEOUT_MS);
    return () => {
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
    };
  }, [ready, authenticated, sessionSynced, syncRetryTick, localIsLoggingOut]);

  // Sync Loop Effect
  useEffect(() => {
    // walletAddress guard: Privy may set authenticated=true before the embedded
    // wallet is ready (email login). Waiting for a non-null wallet address ensures
    // syncSession always sends a valid wallet, avoiding a guaranteed first-attempt
    // failure followed by a 3s retry delay.
    if (!ready || !authenticated || !walletAddress || sessionSynced || localIsLoggingOut || isLoggingOutGlobal)
      return;

    let cancelled = false;
    const now = Date.now();
    if (now < sharedNextRetryAt) {
      const waitMs = Math.max(250, sharedNextRetryAt - now);
      retryTimerRef.current = window.setTimeout(() => {
        if (!cancelled) setSyncRetryTick(v => v + 1);
      }, waitMs);
      return () => {
        cancelled = true;
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      };
    }

    if (!sharedSyncPromise) {
      sharedSyncPromise = ensureServerSession()
        .then(() => {
          setSessionSynced(true);
          setSessionError(null);
        })
        .catch(err => {
          const norm = normalizeSyncError(err);
          sharedSessionSynced = false;
          sharedNextRetryAt = Date.now() + (norm.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS);
          setSessionError(norm.message);
          throw norm;
        })
        .finally(() => {
          sharedSyncPromise = null;
        });
    }

    sharedSyncPromise.catch(() => {
      if (cancelled) return;
      if (sharedSyncAttempts < MAX_SYNC_ATTEMPTS) {
        retryTimerRef.current = window.setTimeout(
          () => {
            setSyncRetryTick(v => v + 1);
          },
          Math.max(250, sharedNextRetryAt - Date.now())
        );
      }
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [ready, authenticated, walletAddress, ensureServerSession, syncRetryTick, sessionSynced, localIsLoggingOut]);

  // Reset when unauthenticated
  useEffect(() => {
    if (ready && !authenticated && !localIsLoggingOut) {
      resetSharedState();
      setSessionSynced(false);
    }
  }, [authenticated, ready, localIsLoggingOut]);

  const signIn = useCallback(async () => {
    if (authenticated) {
      if (!sessionSynced) {
        sharedNextRetryAt = 0;
        sharedSyncAttempts = 0;
        setSessionError(null);
        setSyncRetryTick(v => v + 1);
      }
      return;
    }
    await login();
  }, [authenticated, sessionSynced, login]);

  const signOut = useCallback(async () => {
    if (localIsLoggingOut || isLoggingOutGlobal) return;
    setLocalIsLoggingOut(true);
    isLoggingOutGlobal = true;

    try {
      resetSharedState();
      setSessionSynced(false);
      setSessionError(null);
      await fetchApi('/api/auth/logout', { method: 'POST' }).catch(() => {});
      await logout();
      // Wait for Privy state to fully clear
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      isLoggingOutGlobal = false;
      setLocalIsLoggingOut(false);
    }
  }, [logout, localIsLoggingOut]);

  const retrySessionSync = useCallback(() => {
    sharedNextRetryAt = 0;
    sharedSyncAttempts = 0;
    setSessionError(null);
    setSyncRetryTick(v => v + 1);
  }, []);

  return {
    user: user
      ? { id: user.id, walletAddress: user.wallet?.address || primaryWallet?.address }
      : null,
    loading: !ready || localIsLoggingOut,
    isAuthenticated: authenticated,
    sessionReady: !authenticated || sessionSynced,
    sessionError,
    retrySessionSync,
    signIn,
    signOut,
  };
}
