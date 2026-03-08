"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RandiLogo } from "@/components/branding/RandiLogo";

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultModel: string;
}

interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  agent: {
    name: string;
  };
  createdAt: string;
}

interface IntegrationSummary {
  slug: string;
  label: string;
  connected: boolean;
}

const GENERIC_PROMPTS = [
  "Summarize this link and tell me what matters.",
  "Turn this into a checklist with next steps.",
  "Draft a reply from these notes.",
  "Research this topic and give me the best sources.",
  "Help me plan this task before taking action.",
  "Once this works, help me save it as an automation.",
];

const CHAT_START_STEPS = [
  {
    title: "Start with one concrete task",
    description: "Ask for a real deliverable like a draft, summary, plan, answer, or next step.",
  },
  {
    title: "Let Randi think before acting",
    description: "She can reason, compare options, organize information, and prepare work before using any tool.",
  },
  {
    title: "Review tool actions when needed",
    description: "If a connected app is involved, Randi can pause and ask for approval before anything sensitive runs.",
  },
];

const TRUST_BADGES = ["Research, drafts, and plans", "Approvals stay reviewable", "Automate later when ready"];

const TOOL_PROMPT_MAP: Record<string, string> = {
  gmail: "Draft an email reply from these notes.",
  googlecalendar: "Plan my day from Google Calendar.",
  googlesheets: "Pull the key points from this sheet and summarize them.",
  github: "Review this GitHub issue and suggest the next step.",
  slack: "Write a short Slack update for the team.",
  notion: "Turn these notes into a cleaner brief.",
  telegram: "Draft a short Telegram update I can send.",
  supabase: "Help me inspect this data question before making changes.",
};

function buildPromptChips(connectedIntegrations: IntegrationSummary[]) {
  const suggestions = connectedIntegrations
    .map((integration) => TOOL_PROMPT_MAP[integration.slug])
    .filter(Boolean);

  return Array.from(new Set([...suggestions, ...GENERIC_PROMPTS])).slice(0, 6);
}

export default function ChatHubPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeTab, setActiveTab] = useState<"new" | "recent">("new");
  const [connectedIntegrations, setConnectedIntegrations] = useState<IntegrationSummary[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data.agents || []))
      .catch((err) => console.error("Error fetching agents:", err));

    fetch("/api/chat/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => console.error("Error fetching sessions:", err));

    fetch("/api/composio/integrations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load integrations");
        return res.json();
      })
      .then((data) => {
        setConnectedIntegrations((data.integrations || []).filter((integration: IntegrationSummary) => integration.connected));
      })
      .catch(() => setConnectedIntegrations([]))
      .finally(() => setLoadingConnections(false));
  }, []);

  const leadAgent = agents.find((agent) => agent.slug === "randi-lead");
  const promptChips = useMemo(() => buildPromptChips(connectedIntegrations), [connectedIntegrations]);
  const connectedCount = connectedIntegrations.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 min-h-[calc(100vh-8rem)]">
      <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-6 flex justify-center">
          <RandiLogo size="xl" variant="icon-only" animated className="drop-shadow-2xl" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          Ask Randi
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Start with one concrete task. Randi can research, draft, plan, and use your connected tools when you want her to act.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm font-medium text-muted-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
        <div className="rounded-3xl border border-border bg-card/40 p-6">
          <p className="text-sm font-semibold text-primary">Start here</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">What works best in chat</h2>
          <ul className="mt-4 space-y-4">
            {CHAT_START_STEPS.map((step) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary/80" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card/40 p-6">
          <p className="text-sm font-semibold text-primary">Connected tools</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">
            {loadingConnections ? "Checking tools…" : `${connectedCount} tool${connectedCount === 1 ? "" : "s"} connected`}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {connectedCount > 0
              ? "Randi can work with your connected apps and ask for approval before sensitive actions."
              : "No tools connected yet. You can still chat, plan, and draft — then connect tools when you want Randi to act."}
          </p>
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-4">
            <p className="text-sm font-semibold text-foreground">How approvals feel</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Review happens in chat. When approval is needed, you will see the app, requested action, likely effect, and any target details the tool provides.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {connectedIntegrations.slice(0, 5).map((integration) => (
              <span
                key={integration.slug}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400"
              >
                {integration.label}
              </span>
            ))}
          </div>
          <Link href="/integrations" className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">
            {connectedCount > 0 ? "Manage connected tools" : "Connect tools"}
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        <Link
          href={`/chat/new${leadAgent ? `?agentId=${leadAgent.id}` : ""}`}
          aria-label="Start a new chat with Randi"
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start a new chat
        </Link>
        <button
          onClick={() => setActiveTab(activeTab === "recent" ? "new" : "recent")}
          aria-label={activeTab === "recent" ? "Show suggested starting prompts" : "Show recent chats"}
          className="px-8 py-4 bg-muted/50 hover:bg-muted text-foreground rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 border border-border"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {activeTab === "recent" ? "Show suggested prompts" : `Browse recent chats${sessions.length > 0 ? ` (${sessions.length})` : ""}`}
        </button>
      </div>

      {activeTab === "new" ? (
        <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="text-2xl font-black tracking-tight">Try one of these first tasks</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {connectedCount > 0
                  ? "These suggestions include ideas based on the tools you’ve connected."
                  : "Start with a planning, research, or drafting task. You can connect tools any time."}
              </p>
            </div>
            <Link href="/how-it-works" className="text-sm font-semibold text-primary hover:underline">
              Open getting started guide
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {promptChips.map((chip) => (
              <Link
                key={chip}
                href={`/chat/new${leadAgent ? `?agentId=${leadAgent.id}` : ""}&prompt=${encodeURIComponent(chip)}`}
                className="p-4 bg-card/50 border border-border rounded-xl text-sm font-medium hover:border-primary/40 hover:bg-card transition-all text-left group"
              >
                <span className="text-foreground/85 group-hover:text-foreground transition-colors line-clamp-2 leading-relaxed">
                  {chip}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-500">
          {sessions.length === 0 ? (
            <div className="bg-card/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <p className="text-lg font-semibold">No recent chats yet</p>
              <p className="mt-2 text-muted-foreground">
                Start with a small real task in chat and your history will show up here.
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <Link
                key={session.id}
                href={`/chat/${session.id}`}
                className="flex items-center justify-between bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all group"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{session.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-muted-foreground">{session.agent.name}</span>
                    <span className="text-sm text-muted-foreground/50">•</span>
                    <span className="text-sm text-muted-foreground">{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
