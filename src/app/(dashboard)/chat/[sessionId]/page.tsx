"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ChatWindow, type Message } from "@/components/chat/ChatWindow";
import { RuntimeBadge } from "@/components/chat/RuntimeBadge";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { CustomizeAgentDrawer } from "@/components/chat/CustomizeAgentDrawer";

interface IntegrationSummary {
  slug: string;
  label: string;
  connected: boolean;
}

interface SessionPayload {
  id: string;
  agentId: string;
  agent?: {
    id?: string;
    name?: string;
    slug?: string;
  };
}

const CHAT_GUIDANCE = [
  "Start with one specific task or outcome.",
  "Randi can think, draft, summarize, and plan before taking action.",
  "If a connected tool needs a sensitive step, review it in chat before continuing.",
];

export default function ChatSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionIdFromParams = params.sessionId === "new" ? undefined : (params.sessionId as string);
  const agentIdFromUrl = searchParams.get("agentId");
  const initialPrompt = searchParams.get("prompt")?.trim() || "";
  const defaultAgentId = sessionIdFromParams ? agentIdFromUrl : (agentIdFromUrl || "randi-lead");

  const [loading, setLoading] = useState(Boolean(sessionIdFromParams) || Boolean(defaultAgentId));
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [agentName, setAgentName] = useState(defaultAgentId ? "Randi" : "Agent");
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(defaultAgentId);
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdFromParams);
  const [selectedModel, setSelectedModel] = useState("meta-llama/llama-3.3-70b-instruct:free");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<IntegrationSummary[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const savedModel = localStorage.getItem("randi_selected_model");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("randi_selected_model", selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    fetch("/api/composio/integrations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load integrations");
        return res.json();
      })
      .then((data) => {
        setConnectedIntegrations((data.integrations || []).filter((integration: IntegrationSummary) => integration.connected));
      })
      .catch(() => setConnectedIntegrations([]))
      .finally(() => setToolsLoading(false));
  }, []);

  useEffect(() => {
    if (sessionIdFromParams || sessionId || !currentAgentId) {
      if (!sessionIdFromParams && !sessionId && !currentAgentId) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    const createSession = async () => {
      setLoading(true);
      setSessionError(null);

      try {
        const response = await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: currentAgentId }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.session?.id) {
          throw new Error(data?.error || "Failed to prepare a chat session.");
        }

        if (cancelled) return;

        const session = data.session as SessionPayload;
        setSessionId(session.id);
        setInitialMessages([]);
        setAgentName(typeof session.agent?.name === "string" ? session.agent.name : "Randi");
        if (session.agentId) setCurrentAgentId(session.agentId);
        setLoading(false);

        const promptSuffix = initialPrompt ? `?prompt=${encodeURIComponent(initialPrompt)}` : "";
        router.replace(`/chat/${session.id}${promptSuffix}`);
      } catch (err) {
        if (cancelled) return;
        console.error("Error creating chat session:", err);
        setSessionError(err instanceof Error ? err.message : "Failed to prepare a chat session.");
        setLoading(false);
      }
    };

    void createSession();

    return () => {
      cancelled = true;
    };
  }, [sessionIdFromParams, sessionId, currentAgentId, router, initialPrompt]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const loadSession = async () => {
      setLoading(true);
      setSessionError(null);

      try {
        const response = await fetch(`/api/chat/sessions/${sessionId}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load chat session.");
        }

        if (cancelled) return;

        const messages = Array.isArray(data?.messages)
          ? data.messages.map((message: {
            id?: string;
            role?: "user" | "assistant" | "system" | "tool";
            content?: string;
            createdAt?: string | Date;
          }) => ({
            id: message.id || crypto.randomUUID(),
            role: message.role || "assistant",
            content: typeof message.content === "string" ? message.content : "",
            createdAt:
              message.createdAt instanceof Date
                ? message.createdAt
                : new Date(message.createdAt || Date.now()),
          }))
          : [];

        setInitialMessages(messages);
        setAgentName(typeof data?.agent?.name === "string" ? data.agent.name : "Agent");
        if (data?.agent?.id) setCurrentAgentId(data.agent.id);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching session:", err);
        setSessionError(err instanceof Error ? err.message : "Failed to load chat session.");
        setLoading(false);
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const currentModelLabel = useMemo(() => {
    const suffix = selectedModel.split("/").pop();
    return suffix?.split(":")[0] || selectedModel;
  }, [selectedModel]);
  const connectedCount = connectedIntegrations.length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!currentAgentId && !sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">No chat selected</h2>
          <button
            onClick={() => router.push("/chat")}
            className="bg-primary text-white px-6 py-2 rounded-lg"
          >
            Go to chat hub
          </button>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center">
          <h2 className="text-2xl font-bold">Couldn’t prepare the chat</h2>
          <p className="mt-3 text-sm text-rose-200/90">
            {sessionError || "Randi’s session did not initialize correctly. Please retry and I’ll prepare a fresh chat."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => router.refresh()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/chat")}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Back to chat hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto p-4 md:p-6 gap-4">
      <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/chat")}
              aria-label="Back to chat"
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h2 className="font-bold text-xl">{agentName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-muted-foreground">Active chat</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400">
              Sensitive tool actions pause for review
            </span>
            <span className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-sm font-medium text-muted-foreground">
              {toolsLoading ? "Checking tools…" : `${connectedCount} tool${connectedCount === 1 ? "" : "s"} ready`}
            </span>
            <span className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-sm font-medium text-muted-foreground">
              {currentModelLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CHAT_GUIDANCE.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-sm text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/integrations" className="font-semibold text-primary hover:underline">
            {connectedCount > 0 ? "Manage tools" : "Connect tools"}
          </Link>
          <Link href="/how-it-works" className="font-semibold text-primary hover:underline">
            Getting Started
          </Link>
        </div>

        {sessionError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {sessionError}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[28rem]">
        <ChatWindow
          key={sessionId || `new-${currentAgentId || "agent"}`}
          agentId={currentAgentId || ""}
          sessionId={sessionId}
          model={selectedModel}
          initialMessages={initialMessages}
          initialDraft={initialMessages.length === 0 ? initialPrompt : ""}
        />
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card/20 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-foreground">Workspace details</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Model choice and agent controls live here so the main conversation stays visible first.
            </p>
          </div>
          <button
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            aria-controls="advanced-chat-controls"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {advancedOpen ? "Hide workspace details" : "Show workspace details"}
          </button>
        </div>

        {advancedOpen && (
          <div id="advanced-chat-controls" className="mt-4 rounded-2xl border border-border bg-card/30 p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {toolsLoading ? (
                <span className="text-sm text-muted-foreground">Checking connected tools…</span>
              ) : connectedCount > 0 ? (
                connectedIntegrations.slice(0, 6).map((integration) => (
                  <span
                    key={integration.slug}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400"
                  >
                    {integration.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No tools connected yet.</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsCustomizeOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Agent overrides</span>
              </button>
              <ModelSelector selectedModel={selectedModel} onChange={setSelectedModel} />
              {currentAgentId && <RuntimeBadge agentId={currentAgentId} sessionId={sessionId} />}
            </div>
          </div>
        )}
      </div>

      {currentAgentId && (
        <CustomizeAgentDrawer
          agentId={currentAgentId}
          isOpen={isCustomizeOpen}
          onClose={() => setIsCustomizeOpen(false)}
        />
      )}
    </div>
  );
}
