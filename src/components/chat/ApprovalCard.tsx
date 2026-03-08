"use client";

import { useCallback, useMemo, useState } from "react";

export interface ApprovalRequest {
  approvalId: string;
  toolName: string;
  toolArgs: string;
  description: string;
  sessionId: string;
  summary?: string | null;
}

export type ApprovalDecision = "APPROVED" | "REJECTED" | "PENDING" | "approved" | "rejected" | "pending";

interface ApprovalCardProps {
  request: ApprovalRequest;
  onDecision: (approvalId: string, decision: "APPROVED" | "REJECTED") => void;
  decided?: ApprovalDecision;
}

function formatArgs(raw: string): { parsed: Record<string, unknown> | null; entries: [string, string][]; raw: string } {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      ] as [string, string]);

      return {
        parsed: parsed as Record<string, unknown>,
        entries,
        raw,
      };
    }
  } catch {
    // ignore invalid JSON
  }

  return { parsed: null, entries: [], raw };
}

function serviceFromToolName(toolName: string): string {
  const service = toolName.split("_")[0];
  const map: Record<string, string> = {
    GMAIL: "Gmail",
    GITHUB: "GitHub",
    GITLAB: "GitLab",
    SLACK: "Slack",
    DISCORD: "Discord",
    TELEGRAM: "Telegram",
    NOTION: "Notion",
    GOOGLESHEETS: "Google Sheets",
    GOOGLECALENDAR: "Google Calendar",
    GOOGLEDOCS: "Google Docs",
    GOOGLEDRIVE: "Google Drive",
    VERCEL: "Vercel",
    SUPABASE: "Supabase",
    AIRTABLE: "Airtable",
    JIRA: "Jira",
    LINEAR: "Linear",
    HUBSPOT: "HubSpot",
    SALESFORCE: "Salesforce",
    TWILIO: "Twilio",
    STRIPE: "Stripe",
  };
  return map[service] ?? service;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function prettyActionLabel(toolName: string) {
  const parts = toolName.split("_");
  return toTitleCase(parts.slice(1).join(" ") || parts[0]);
}

function pickEntryValue(entries: [string, string][], preferredKeys: string[]) {
  const match = entries.find(([key, value]) => preferredKeys.includes(key) && value);
  return match ? match[1] : null;
}

function inferTarget(entries: [string, string][]) {
  return pickEntryValue(entries, [
    "email",
    "to",
    "recipient",
    "channel",
    "channel_id",
    "threadId",
    "thread_id",
    "repo",
    "repository",
    "owner",
    "branch",
    "issueId",
    "issue_id",
    "pullRequestId",
    "pull_request_id",
    "sheetId",
    "sheet_id",
    "docId",
    "doc_id",
    "databaseId",
    "database_id",
    "pageId",
    "page_id",
    "projectId",
    "project_id",
    "calendarId",
    "calendar_id",
    "walletAddress",
    "wallet_address",
    "destinationAddress",
    "destination_address",
    "fileId",
    "file_id",
    "url",
  ]);
}

function inferAccount(entries: [string, string][]) {
  return pickEntryValue(entries, [
    "account",
    "accountId",
    "account_id",
    "workspace",
    "workspaceId",
    "workspace_id",
    "team",
    "teamId",
    "team_id",
    "org",
    "orgId",
    "org_id",
    "organization",
    "organizationId",
    "organization_id",
    "user",
    "userId",
    "user_id",
  ]);
}

function inferResource(entries: [string, string][]) {
  return pickEntryValue(entries, [
    "pageId",
    "page_id",
    "databaseId",
    "database_id",
    "messageId",
    "message_id",
    "eventId",
    "event_id",
    "docId",
    "doc_id",
    "sheetId",
    "sheet_id",
    "projectId",
    "project_id",
  ]);
}

function buildServiceBadge(service: string) {
  const parts = service.split(" ").filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  return service.slice(0, 2).toUpperCase();
}

function inferRisk(toolName: string) {
  const upper = toolName.toUpperCase();
  if (/(DELETE|REMOVE|CANCEL|TRANSFER|PAY|EXECUTE|PURCHASE|WITHDRAW)/.test(upper)) {
    return { level: "High", tone: "rose" as const, summary: "This action may make a harder-to-undo external change." };
  }

  if (/(CREATE|UPDATE|POST|SEND|WRITE|UPLOAD|PUBLISH|INSERT|PATCH)/.test(upper)) {
    return { level: "Medium", tone: "amber" as const, summary: "This action writes or updates something in the connected app." };
  }

  if (/(GET|LIST|SEARCH|READ|FETCH)/.test(upper)) {
    return { level: "Low", tone: "emerald" as const, summary: "This action mostly reads information from the connected app." };
  }

  return { level: "Review", tone: "primary" as const, summary: "Review the details before approving the request." };
}

function labelTone(tone: "rose" | "amber" | "emerald" | "primary") {
  const tones: Record<typeof tone, string> = {
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    primary: "border-primary/20 bg-primary/10 text-primary",
  };
  return tones[tone];
}

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function ApprovalCard({ request, onDecision, decided = "PENDING" }: ApprovalCardProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const status = decided.toLowerCase();
  const service = serviceFromToolName(request.toolName);
  const serviceBadge = buildServiceBadge(service);
  const { entries, raw } = useMemo(() => formatArgs(request.toolArgs), [request.toolArgs]);
  const target = useMemo(() => inferTarget(entries), [entries]);
  const account = useMemo(() => inferAccount(entries), [entries]);
  const resource = useMemo(() => inferResource(entries), [entries]);
  const risk = useMemo(() => inferRisk(request.toolName), [request.toolName]);
  const actionLabel = useMemo(() => prettyActionLabel(request.toolName), [request.toolName]);
  const summary = request.summary?.trim() || request.description?.trim() || `${actionLabel} in ${service}`;
  const actionSummary = `Randi wants to ${actionLabel.charAt(0).toLowerCase()}${actionLabel.slice(1)} in ${service}. Review the details before deciding whether to continue.`;

  const handleDecision = useCallback(
    async (decision: "APPROVED" | "REJECTED") => {
      setLoading(true);
      setActionError(null);
      try {
        const response = await fetch("/api/chat/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId: request.approvalId, decision }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Could not record your decision. Please try again.");
        }

        onDecision(request.approvalId, decision);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not record your decision. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onDecision, request.approvalId]
  );

  const isDone = status !== "pending";

  return (
    <div className="my-2 max-w-[90%] lg:max-w-[75%]">
      <div className={`overflow-hidden rounded-3xl border shadow-lg transition-all ${
        status === "approved"
          ? "border-emerald-500/40 bg-emerald-500/[0.02]"
          : status === "rejected"
            ? "border-rose-500/30 bg-rose-500/[0.02]"
            : "border-amber-500/40 bg-amber-500/[0.02]"
      }`}>
        <div className={`flex items-start gap-4 border-b px-6 py-5 ${
          status === "approved"
            ? "border-emerald-500/10"
            : status === "rejected"
              ? "border-rose-500/10"
            : "border-amber-500/10"
        }`}>
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-sm font-bold tracking-[0.2em] text-foreground shadow-inner">
            {serviceBadge}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Approval review</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                status === "approved"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : status === "rejected"
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-amber-500/10 text-amber-400"
              }`}>
                {status === "approved" ? "Approved" : status === "rejected" ? "Declined" : "Needs review"}
              </span>
            </div>
            <h3 className="text-lg font-bold leading-tight text-foreground">
              {summary}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {actionSummary}
            </p>
          </div>
        </div>

        <div className="bg-background/10 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">App or tool</p>
              <p className="mt-2 text-base font-semibold">{service}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Requested action</p>
              <p className="mt-2 text-base font-semibold">{actionLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Likely effect</p>
              <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{risk.summary}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Target or resource</p>
              <p className="mt-2 text-sm text-foreground/90 break-all leading-relaxed">
                {target || resource || "Not provided in this request."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${labelTone(risk.tone)}`}>
              {risk.level} review
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted-foreground">
              Session {request.sessionId.slice(-6)}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-border/60 bg-background/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Why Randi is asking</p>
            <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
              {request.description}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Account or workspace</p>
              <p className="mt-2 text-sm text-foreground/90 break-all leading-relaxed">
                {account || "Not provided in this request."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">What your choice means</p>
              <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
                Approve to let Randi continue with this step. Decline to stop this request so nothing from this approval runs.
              </p>
            </div>
          </div>

          {(entries.length > 0 || raw) && (
            <details className="mt-4 rounded-2xl border border-border/60 bg-background/20 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">Show technical details</summary>
              {entries.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex gap-4 text-sm">
                      <span className="w-32 flex-shrink-0 font-semibold text-muted-foreground capitalize">
                        {formatKey(key)}
                      </span>
                      <span className="break-all text-foreground/90">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="mt-4 max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-xl border border-white/5 bg-black/30 p-3 text-sm text-foreground/70">
                  {raw}
                </pre>
              )}
              <p className="mt-4 text-sm text-muted-foreground">Tool: {request.toolName}</p>
            </details>
          )}

          {actionError && (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
              <p className="text-sm text-rose-300">{actionError}</p>
            </div>
          )}
        </div>

        {!isDone ? (
          <div className="flex gap-3 p-6">
            <button
              onClick={() => handleDecision("APPROVED")}
              disabled={loading}
              className="flex-1 rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? "Saving decision…" : "Approve and continue"}
            </button>
            <button
              onClick={() => handleDecision("REJECTED")}
              disabled={loading}
              className="flex-1 rounded-2xl border border-rose-500/30 py-3.5 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-500/10 disabled:opacity-50"
            >
              Decline request
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/10 px-6 py-4">
            <span className="text-sm text-muted-foreground">
              {status === "approved"
                ? "Approved. Randi will continue and report the result in chat."
                : "Declined. This request will not run."}
            </span>
            <span className="text-sm font-mono opacity-40">ID: {request.approvalId.slice(-6)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
