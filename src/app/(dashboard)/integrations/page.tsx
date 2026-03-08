"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { COMPOSIO_CATEGORIES } from "@/lib/composio/integrations";

interface IntegrationItem {
  slug: string;
  label: string;
  category: string;
  icon: string;
  logo: string | null;
  description: string;
  hasAuthConfig: boolean;
  authConfigId: string | null;
  connectedAccountId: string | null;
  connectedStatus: string;
  connectedStatusReason: string | null;
  connectedAccountCount: number;
  connected: boolean;
  capabilities: string[];
  suggestedPrompt: string | null;
}

interface IntegrationsResponse {
  composioUserId: string;
  sharedEntityMode: boolean;
  integrations: IntegrationItem[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
        Connected
      </span>
    );
  }

  if (status === "INITIATED" || status === "INITIALIZING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        Pending
      </span>
    );
  }

  if (status === "FAILED" || status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
        Action Needed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      Available
    </span>
  );
}

function connectionSummary(integration: IntegrationItem) {
  if (integration.connected) {
    if (integration.connectedAccountCount > 1) {
      return `${integration.connectedAccountCount} accounts connected and ready for chat.`;
    }

    if (integration.connectedAccountCount === 1) {
      return "1 account connected. Randi can now access this app.";
    }

    return "Connected and ready for chat actions.";
  }

  if (!integration.hasAuthConfig) {
    return "Not yet configured for this workspace.";
  }

  if (integration.connectedStatus === "INITIATED" || integration.connectedStatus === "INITIALIZING") {
    return "Connection in progress. Complete the authorization window.";
  }

  return "Connect to enable chat capabilities for this app.";
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
  const capabilities = integration.capabilities.length > 0 
    ? integration.capabilities 
    : ["Use inside chat after connecting", "Let Randi work in this app"];
  const suggestedPrompt = integration.suggestedPrompt || "Help me use this connected tool inside chat.";

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-[2rem] border transition-all duration-300 ${isConnected
        ? "border-emerald-500/30 bg-emerald-500/[0.02] ring-1 ring-emerald-500/10"
        : "border-border bg-card/50 hover:border-border/80 hover:bg-card"
        }`}
    >
      {/* Header section */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl shadow-sm transition-transform group-hover:scale-105 ${isConnected ? "bg-emerald-500/10" : "bg-muted"
              }`}
          >
            {integration.logo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={integration.logo} alt={`${integration.label} logo`} className="h-full w-full object-contain p-2" />
              </>
            ) : (
              <span className="filter grayscale group-hover:grayscale-0 transition-all">{integration.icon}</span>
            )}
          </div>
          <StatusBadge status={integration.connectedStatus} />
        </div>
        
        <div className="mt-5">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{integration.label}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">
            {integration.description}
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <div className="space-y-4">
          {/* Capabilities */}
          <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Capabilities</h4>
            <ul className="mt-2.5 space-y-2">
              {capabilities.map((capability) => (
                <li key={capability} className="flex items-center gap-2 text-sm text-foreground/80">
                  <div className={`h-1 w-1 rounded-full ${isConnected ? "bg-emerald-400" : "bg-primary/40"}`} />
                  {capability}
                </li>
              ))}
            </ul>
          </div>

          {/* Status & Trust */}
          <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status & Safety</h4>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {connectionSummary(integration)}
            </p>
            {isConnected && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/5 px-2 py-1.5 text-[11px] font-medium text-emerald-400/90">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Requires approval for sensitive actions
              </div>
            )}
            {!isConnected && !canConnect && (
               <p className="mt-3 text-xs font-medium text-amber-400/80">
                 Workplace admin setup required
               </p>
            )}
          </div>

          {/* Suggested prompt after connection */}
          {isConnected && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 transition-colors hover:bg-emerald-500/[0.08]">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Try it in chat</h4>
              <p className="mt-2 text-sm italic leading-relaxed text-foreground/90">
                &ldquo;{suggestedPrompt}&rdquo;
              </p>
              <Link
                href={`/chat/new?prompt=${encodeURIComponent(suggestedPrompt)}`}
                className="mt-3.5 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
              >
                Launch Prompt
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onConnect(integration.slug)}
            disabled={isBusy || !canConnect}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isConnected
              ? "border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15"
              : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
              }`}
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Working…
              </span>
            ) : isConnected ? "Reconnect" : "Connect App"}
          </button>
          {isConnected && (
            <button
              onClick={() => onDisconnect(integration.slug)}
              disabled={isBusy}
              className="flex items-center justify-center rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm font-bold transition-all hover:border-destructive/40 hover:bg-destructive/5 hover:text-rose-400 disabled:opacity-40"
              title="Disconnect"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
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
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async (isInitial = false) => {
    if (!isAuthenticated || !sessionReady) return;

    if (isInitial) setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/composio/integrations", { cache: "no-store" });
      const payload = (await response.json()) as IntegrationsResponse & { error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          retrySessionSync();
          return;
        }

        throw new Error(payload.error || "Failed to load integrations");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, sessionReady, retrySessionSync]);

  useEffect(() => {
    if (!isAuthenticated || !sessionReady) {
      if (!loadingAuth && !isAuthenticated) {
        setLoading(false);
        setError("Unauthorized");
      }
      return;
    }

    load(true).catch(() => { });
  }, [isAuthenticated, sessionReady, loadingAuth, load, searchParams]);

  const callbackBanner = useMemo(() => {
    const status = searchParams.get("status");
    const toolkit = searchParams.get("toolkit");
    if (!status) return null;

    const suffix = toolkit ? ` for ${toolkit}` : "";
    if (status === "success") {
      return {
        tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        text: `Connection completed${suffix}. You can now try it from chat.`,
      };
    }

    if (status === "failed") {
      return {
        tone: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        text: `Connection failed${suffix}. Review the setup and try again.`,
      };
    }

    return {
      tone: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      text: `Connection returned status "${status}"${suffix}.`,
    };
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
    return data.integrations.filter((integration) => {
      const matchesCategory = activeCategory === "All" || integration.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery = !query
        || integration.label.toLowerCase().includes(query)
        || integration.description.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [data, activeCategory, searchQuery]);

  const connectedCount = useMemo(
    () => data?.integrations.filter((integration) => integration.connected).length ?? 0,
    [data]
  );

  const availableCount = data?.integrations.length ?? 0;

  const categories = useMemo(() => {
    if (!data) return ["All"];

    const present = new Set<string>();
    data.integrations.forEach((integration) => {
      if (integration.category) present.add(integration.category);
    });

    const ordered = COMPOSIO_CATEGORIES.filter((category) => present.has(category));
    const extras = Array.from(present).filter((category) => !COMPOSIO_CATEGORIES.includes(category as never)).sort((a, b) => a.localeCompare(b));
    return ["All", ...ordered, ...extras];
  }, [data]);

  return (
    <div className="max-w-6xl space-y-12 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            Workspace Capabilities
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Connect your tools</h1>
          <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Enable Randi to read, draft, and act across your favorite apps. Connections are secure and require your approval for sensitive actions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]">
            Open Chat
          </Link>
          <Link href="/how-it-works" className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-6 text-sm font-bold transition-all hover:bg-muted">
            Safety Guide
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="group rounded-3xl border border-border bg-card/40 p-6 transition-colors hover:bg-card/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Active Connections</p>
          <p className="mt-1 text-4xl font-black tracking-tight">{loading ? "—" : connectedCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Ready for real actions in chat.</p>
        </div>
        
        <div className="group rounded-3xl border border-border bg-card/40 p-6 transition-colors hover:bg-card/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Apps Supported</p>
          <p className="mt-1 text-4xl font-black tracking-tight">{loading ? "—" : availableCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Only connect what you actually use.</p>
        </div>

        <div className="group rounded-3xl border border-border bg-card/40 p-6 transition-colors hover:bg-card/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Privacy First</p>
          <p className="mt-1 text-xl font-black tracking-tight">Review & Approve</p>
          <p className="mt-2 text-sm text-muted-foreground">Randi only acts when you say it&apos;s okay.</p>
        </div>
      </div>

      <div className="space-y-6">
        {callbackBanner && (
          <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium shadow-sm ${callbackBanner.tone}`}>
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {callbackBanner.text}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-400">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {data?.sharedEntityMode && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-400">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Shared workspace mode enabled. Connections may be accessible to other users.
          </div>
        )}

        {!loading && data && (
          <div className="flex flex-col gap-4 rounded-[2rem] border border-border bg-card/30 p-6 md:flex-row md:items-end">
            <div className="flex-1 space-y-2.5">
              <label htmlFor="integration-search" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                Search Catalog
              </label>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="integration-search"
                  type="text"
                  placeholder="Find by app name or description..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-11 py-3.5 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5 placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div className="min-w-[240px] space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Category</p>
              <div className="flex flex-wrap gap-1.5">
                <select 
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-medium focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-[2rem] border border-border bg-muted/20" />
            ))}
          </div>
        ) : !data ? (
          <div className="rounded-[2rem] border border-border bg-card/30 px-6 py-12 text-center text-muted-foreground">
            <p className="font-bold">Unable to load catalog.</p>
            <button onClick={() => load(true)} className="mt-4 text-sm font-bold text-primary hover:underline">Try refreshing</button>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border bg-card/10 px-6 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="mt-6 text-xl font-bold">No integrations found</h3>
            <p className="mt-2 text-muted-foreground">Try adjusting your search or category filters.</p>
            <button 
              onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
              className="mt-6 text-sm font-bold text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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