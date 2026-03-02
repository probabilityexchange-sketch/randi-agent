"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { COMPOSIO_CATEGORIES, type ComposioCategory } from "@/lib/composio/integrations";
import { TelegramSetup } from "@/components/settings/TelegramSetup";

interface IntegrationItem {
  slug: string;
  label: string;
  category: ComposioCategory;
  icon: string;
  description: string;
  hasAuthConfig: boolean;
  authConfigId: string | null;
  authConfigName: string | null;
  authConfigCount: number | null;
  authConfigError: string | null;
  connectedAccountId: string | null;
  connectedStatus: string;
  connectedStatusReason: string | null;
  connectedAccountCount: number;
  connected: boolean;
}

interface IntegrationsResponse {
  composioUserId: string;
  sharedEntityMode: boolean;
  integrations: IntegrationItem[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Connected
      </span>
    );
  }
  if (status === "INITIATED" || status === "INITIALIZING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Pending
      </span>
    );
  }
  if (status === "FAILED" || status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium text-muted-foreground">Not connected</span>
  );
}

function IntegrationCard({
  integration,
  isBusy,
  onConnect,
  onDisconnect,
}: {
  integration: IntegrationItem;
  isBusy: boolean;
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
}) {
  const isConnected = integration.connected;
  const canConnect = integration.hasAuthConfig;

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 ${isConnected
        ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
        : "border-border bg-card hover:border-border/80 hover:bg-card/80"
        }`}
    >
      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isConnected ? "bg-emerald-500/15" : "bg-muted/60"
            }`}
        >
          {integration.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm leading-tight">{integration.label}</h3>
            <StatusBadge status={integration.connectedStatus} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {integration.description}
          </p>
        </div>
      </div>

      {/* Auth config warning */}
      {!canConnect && (
        <p className="text-[10px] text-amber-400/80 bg-amber-500/10 rounded-lg px-2.5 py-1.5 font-medium">
          Setup required. This integration isn't available yet. Check back soon.
        </p>
      )}

      {/* Status reason */}
      {integration.connectedStatusReason && (
        <p className="text-[10px] text-rose-400">{integration.connectedStatusReason}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onConnect(integration.slug)}
          disabled={isBusy || !canConnect}
          className={`flex-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isConnected
            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-primary hover:bg-primary/90 text-white"
            }`}
        >
          {isBusy ? "Working…" : isConnected ? "Reconnect" : "Connect"}
        </button>
        {isConnected && (
          <button
            onClick={() => onDisconnect(integration.slug)}
            disabled={isBusy}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/40 hover:text-rose-400 transition-colors disabled:opacity-40"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function IntegrationsPageContent() {
  const { isAuthenticated, loading: loadingAuth, sessionReady, sessionError, retrySessionSync } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyToolkit, setBusyToolkit] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ComposioCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      if (!loadingAuth) {
        setLoading(false);
        setData(null);
        setError("Unauthorized");
      }
      return;
    }
    if (!sessionReady) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let response = await fetch("/api/composio/integrations", { cache: "no-store" });
      let payload = (await response.json()) as IntegrationsResponse & { error?: string };
      if (response.status === 401) {
        retrySessionSync();
        await new Promise((resolve) => setTimeout(resolve, 500));
        response = await fetch("/api/composio/integrations", { cache: "no-store" });
        payload = (await response.json()) as IntegrationsResponse & { error?: string };
      }
      if (!response.ok) throw new Error(payload.error || "Failed to load integrations");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load integrations");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, sessionReady, retrySessionSync]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (!loadingAuth) {
        setLoading(false);
        setData(null);
        setError("Unauthorized");
      }
      return;
    }
    if (!sessionReady) {
      setLoading(true);
      return;
    }
    load().catch(() => { });
  }, [isAuthenticated, sessionReady, load, searchParams]);

  const callbackBanner = useMemo(() => {
    const status = searchParams.get("status");
    const toolkit = searchParams.get("toolkit");
    if (!status) return null;
    const suffix = toolkit ? ` for ${toolkit}` : "";
    if (status === "success") return { tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", text: `✅ Connection completed${suffix}.` };
    if (status === "failed") return { tone: "text-rose-400 bg-rose-500/10 border-rose-500/20", text: `❌ Connection failed${suffix}. Please try again.` };
    return { tone: "text-amber-400 bg-amber-500/10 border-amber-500/20", text: `Connection returned status "${status}"${suffix}.` };
  }, [searchParams]);

  const connect = useCallback(async (toolkit: string) => {
    setBusyToolkit(toolkit);
    setError(null);
    try {
      const res = await fetch("/api/composio/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      const payload = (await res.json()) as { error?: string; redirectUrl?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to start connection");
      if (!payload.redirectUrl) throw new Error("Missing Composio redirect URL");
      window.location.assign(payload.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection");
      setBusyToolkit(null);
    }
  }, []);

  const disconnect = useCallback(async (toolkit: string) => {
    setBusyToolkit(toolkit);
    setError(null);
    try {
      const res = await fetch("/api/composio/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to disconnect");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setBusyToolkit(null);
    }
  }, [load]);

  const filteredIntegrations = useMemo(() => {
    if (!data) return [];
    return data.integrations.filter((i) => {
      const cat = activeCategory === "All" || i.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const search = !q || i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
      return cat && search;
    });
  }, [data, activeCategory, searchQuery]);

  const connectedCount = useMemo(
    () => data?.integrations.filter((i) => i.connected).length ?? 0,
    [data]
  );

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your accounts so agents can take real actions — not just give advice.
          {data && (
            <span className="ml-2 text-xs text-emerald-400">
              {connectedCount} of {data.integrations.length} connected
            </span>
          )}
        </p>
      </div>

      {/* Banners */}
      {callbackBanner && (
        <div className={`text-sm rounded-xl border px-4 py-3 ${callbackBanner.tone}`}>
          {callbackBanner.text}
        </div>
      )}
      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {!sessionReady && isAuthenticated && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          Finalizing session…{sessionError ? ` ${sessionError}` : ""}
        </div>
      )}
      {data?.sharedEntityMode && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          ⚠️ Shared mode — connections are shared across all users.
        </div>
      )}

      {/* Search + Category filters */}
      {!loading && data && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Search integrations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-xl bg-muted border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
          <div className="flex flex-wrap gap-2">
            {(["All", ...COMPOSIO_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as ComposioCategory | "All")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : !data ? (
        <div className="text-muted-foreground text-sm">Unable to load integrations.</div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">No integrations match your filter.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.slug}
              integration={integration}
              isBusy={busyToolkit === integration.slug}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          ))}
        </div>
      )}

      {/* Telegram Setup Tutorial */}
      <div className="mt-16 pt-8 border-t border-border">
        <h2 className="text-xl font-bold mb-6">Messaging Control</h2>
        <TelegramSetup />
      </div>

    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm">Loading integrations…</div>}>
      <IntegrationsPageContent />
    </Suspense>
  );
}
