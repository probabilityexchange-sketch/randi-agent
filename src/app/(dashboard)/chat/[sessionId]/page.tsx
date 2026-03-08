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

interface AgentSummary {
  id: string;
  slug: string;
  name: string;
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

  const [loading, setLoading] = useState(sessionIdFromParams ? true : false);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [agentName, setAgentName] = useState("Agent");
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(agentIdFromUrl);
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdFromParams);
  const [selectedModel, setSelectedModel] = useState("meta-llama/llama-3.3-70b-instruct:free");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<IntegrationSummary[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);

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
    if (sessionId) {
      fetch(`/api/chat/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          const messages = Array.isArray(data?.messages)
            ? data.messages.map((message: {
              id?: string;
              role?: "user" | "assistant" | "system";
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
        })
        .catch((err) => {
          console.error("Error fetching session:", err);
          setLoading(false);
        });
    } else if (agentIdFromUrl) {
      fetch(`/api/agents`)
        .then((res) => res.json())
        .then((data) => {
          const agent = (data.agents as AgentSummary[]).find((item) => item.id === agentIdFromUrl || item.slug === agentIdFromUrl);
          if (agent) setAgentName(agent.name);
        })
        .catch((err) => console.error("Error fetching agent:", err));
    }
  }, [sessionId, agentIdFromUrl]);

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

  if (!agentIdFromUrl && !sessionId) {
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/chat")}
              aria-label="Back to chat hub"
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
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
            Sensitive tool actions pause here for review
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <p className="text-sm font-semibold text-primary">Core chat</p>
            <h3 className="mt-2 text-xl font-black tracking-tight">Ask for a real result, not just a topic</h3>
            <ul className="mt-4 space-y-3">
              {CHAT_GUIDANCE.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary/80" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-sm font-semibold text-foreground">Approval review stays calm and visible</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                When approval is needed, Randi pauses in chat and shows what app is involved, what she wants to do, what it likely affects, and what approving or declining means.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <p className="text-sm font-semibold text-primary">Connected tools</p>
            <h3 className="mt-2 text-xl font-black tracking-tight">
              {toolsLoading ? "Checking tools…" : `${connectedCount} tool${connectedCount === 1 ? "" : "s"} ready`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {connectedCount > 0
                ? "Connected tools can help when the task needs real context or actions outside chat."
                : "No tools connected yet. You can still use chat for planning, analysis, and drafting."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {toolsLoading ? (
                <span className="text-sm text-muted-foreground">Checking connected tools…</span>
              ) : connectedCount > 0 ? (
                connectedIntegrations.slice(0, 5).map((integration) => (
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
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Current model</p>
                <p className="font-semibold mt-1">{currentModelLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Approval behavior</p>
                <p className="font-semibold mt-1">Sensitive actions can ask for review before running.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/integrations" className="text-sm font-semibold text-primary hover:underline">
                {connectedCount > 0 ? "Manage tools" : "Connect tools"}
              </Link>
              <Link href="/how-it-works" className="text-sm font-semibold text-primary hover:underline">
                Getting started
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-card/20 p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-foreground">Advanced controls</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional settings for model choice and agent customization. These do not override approval review.
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
              {advancedOpen ? "Hide advanced controls" : "Show advanced controls"}
            </button>
          </div>

          {advancedOpen && (
            <div id="advanced-chat-controls" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/30 p-4">
              <button
                onClick={() => setIsCustomizeOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Customize agent</span>
              </button>
              <ModelSelector selectedModel={selectedModel} onChange={setSelectedModel} />
              {currentAgentId && <RuntimeBadge agentId={currentAgentId} sessionId={sessionId} />}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChatWindow
          key={sessionId || `new-${currentAgentId || "agent"}`}
          agentId={currentAgentId || ""}
          sessionId={sessionId}
          model={selectedModel}
          initialMessages={initialMessages}
          onSessionCreated={(newSessionId) => {
            setSessionId(newSessionId);
            if (!sessionId && typeof window !== "undefined") {
              const suffix = currentAgentId ? `?agentId=${encodeURIComponent(currentAgentId)}` : "";
              window.history.replaceState(window.history.state, "", `/chat/${newSessionId}${suffix}`);
            }
          }}
        />
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
