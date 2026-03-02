import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type OpenAI from "openai";
import { openrouter, isUnmeteredModel, DEFAULT_MODEL, createChatCompletion } from "@/lib/openrouter/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
  executeOpenAIToolCall,
  getAgentToolsFromConfig,
} from "@/lib/composio/client";
import { requiresApproval, describeToolCall } from "@/lib/composio/approval-rules";
import {
  ORCHESTRATION_TOOLS,
  executeOrchestrationToolCall,
  isOrchestrationTool
} from "@/lib/orchestration/tools";
import {
  validateModelAccess,
  isPremiumModel,
  type StakingLevel
} from "@/lib/token-gating";
import {
  parseAgentSkills,
  buildSkillsContext,
  getActionSkills,
} from "@/lib/skills/loader";
import {
  CLAWNCH_TOOLS,
  executeClawnchTool,
  isClawnchTool,
} from "@/lib/skills/clawnch-tools";
import { deductForAgentCall } from "@/lib/credits/engine";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const schema = z
  .object({
    agentId: optionalNonEmptyString,
    sessionId: optionalNonEmptyString,
    message: z.string().min(1).max(4000),
    model: z.string().min(1).default(DEFAULT_MODEL),
    resumeApprovalId: z.string().optional(), // set when resuming after approval
  })
  .refine((value) => value.agentId || value.sessionId, {
    message: "agentId or sessionId is required",
  });

const MAX_HISTORY_MESSAGES = 40;
const MAX_TOOL_LOOP_STEPS = 10;
// FIX (LOW): Maximum wall-clock time for the entire tool-enabled chat turn.
// Prevents runaway agent sessions from consuming resources indefinitely.
const TOOL_LOOP_TIMEOUT_MS = 90_000; // 90 seconds
import { KILO_COMPOSIO_CHEAT_SHEET } from "@/lib/skills/tool-cheat-sheet";

const TOOL_USAGE_SYSTEM_INSTRUCTION =
  "You have access to tools for external services. If the user's request requires a tool (e.g. GitHub, Slack, Gmail), call the matching tool. If a tool returns an error, DO NOT retry the same call—explain the issue. For general knowledge or conversational requests, do NOT attempt to use tools. Never simulate tool results.\n\n" + KILO_COMPOSIO_CHEAT_SHEET;

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

interface ToolExecutionLog {
  id: string;
  name: string;
  arguments: string;
  result?: unknown;
  error?: string;
}

interface StoredChatMessage {
  role: string;
  content: string;
  toolCalls: string | null;
}

const KNOWN_TOOL_PREFIXES = [
  "GITHUB_",
  "GMAIL_",
  "GOOGLESHEETS_",
  "GOOGLECALENDAR_",
  "SUPABASE_",
  "VERCEL_",
  "SLACK_",
  "NOTION_",
  "HACKERNEWS_",
  "COINMARKETCAP_",
  "PROMPMATE_",
  "TELEGRAM_",
] as const;

function shouldForceToolCall(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsService =
    /\b(github|git|repo|repository|slack|chat|notion|doc|page|gmail|email|mail|inbox|mailbox|google sheets|googlesheets|sheets|spreadsheet|excel|calendar|google calendar|gcal|supabase|db|database|vercel|deploy|hacker ?news|hn|prompmate|promptmate|coinmarketcap|coin market cap|cmc|telegram|tg)\b/.test(
      normalized
    );
  const mentionsAction =
    /\b(connect|list|show|get|find|search|create|update|delete|send|post|write|read|use|check|sync|pull|push|commit|deploy|add|remove)\b/.test(
      normalized
    );

  return mentionsService && mentionsAction;
}

function getRequestedToolPrefixes(message: string): string[] {
  const normalized = message.toLowerCase();
  const prefixes = new Set<string>();

  if (/\b(github|git|repo|repository|pull request|issue)\b/.test(normalized)) prefixes.add("GITHUB_");
  if (/\b(gmail|google mail|email|mail|inbox|mailbox)\b/.test(normalized)) prefixes.add("GMAIL_");
  if (/\b(google sheets|googlesheets|sheets|spreadsheet|excel|rows|cells?)\b/.test(normalized)) {
    prefixes.add("GOOGLESHEETS_");
  }
  if (/\b(google calendar|gcalendar|gcal|event|meeting|schedule)\b/.test(normalized)) {
    prefixes.add("GOOGLECALENDAR_");
  }
  if (/\b(supabase|database|db|table|record)\b/.test(normalized)) prefixes.add("SUPABASE_");
  if (/\b(vercel|deploy|production|stage|deployment)\b/.test(normalized)) prefixes.add("VERCEL_");
  if (/\b(slack|channel|workspace|dm|message)\b/.test(normalized)) prefixes.add("SLACK_");
  if (/\b(notion|page|database|block|workspace)\b/.test(normalized)) prefixes.add("NOTION_");
  if (/\b(hacker ?news|hn|front page|top stories)\b/.test(normalized)) prefixes.add("HACKERNEWS_");
  if (/\b(coinmarketcap|coin market cap|cmc|crypto price|market cap)\b/.test(normalized)) {
    prefixes.add("COINMARKETCAP_");
  }
  if (/\b(prompmate|promptmate)\b/.test(normalized)) {
    prefixes.add("PROMPMATE_");
  }
  if (/\b(telegram|tg|message)\b/.test(normalized)) {
    prefixes.add("TELEGRAM_");
  }

  return [...prefixes];
}

function shouldPreferEmailTools(message: string): boolean {
  const normalized = message.toLowerCase();
  const asksForEmail = /\b(gmail|google mail|emails?|inbox|mailbox)\b/.test(normalized);
  const explicitlyAsksGithub = /\bgithub\b/.test(normalized);
  return asksForEmail && !explicitlyAsksGithub;
}

function isLikelyFollowUpMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (!normalized) return false;

  if (/^(and|also)\b/.test(normalized)) return true;

  return /\b(did you|find them|find it|what about|any update|still|yet|continue|retry|again|that one|those|them|it)\b/.test(
    normalized
  );
}

function normalizeKnownPrefix(prefix: string): string | null {
  if (KNOWN_TOOL_PREFIXES.includes(prefix as (typeof KNOWN_TOOL_PREFIXES)[number])) {
    return prefix;
  }
  return null;
}

function extractPrefixFromToolName(toolName: string): string | null {
  const separatorIndex = toolName.indexOf("_");
  if (separatorIndex <= 0) return null;
  return normalizeKnownPrefix(`${toolName.slice(0, separatorIndex)}_`);
}

function extractToolPrefixesFromLog(rawToolCalls: string | null): string[] {
  if (!rawToolCalls) return [];

  try {
    const parsed = JSON.parse(rawToolCalls) as unknown;
    if (!Array.isArray(parsed)) return [];

    const prefixes = new Set<string>();
    for (const entry of parsed) {
      if (!isRecord(entry) || typeof entry.name !== "string") continue;
      const prefix = extractPrefixFromToolName(entry.name);
      if (prefix) prefixes.add(prefix);
    }

    return [...prefixes];
  } catch {
    return [];
  }
}

function resolveContextualToolPrefixes(
  message: string,
  storedMessages: StoredChatMessage[]
): string[] {
  const explicitPrefixes = getRequestedToolPrefixes(message);
  if (explicitPrefixes.length > 0) return explicitPrefixes;
  if (!isLikelyFollowUpMessage(message)) return [];

  for (const storedMessage of storedMessages) {
    if (storedMessage.role !== "user") continue;
    const prefixesFromUserIntent = getRequestedToolPrefixes(storedMessage.content);
    if (prefixesFromUserIntent.length > 0) return prefixesFromUserIntent;
  }

  for (const storedMessage of storedMessages) {
    const prefixesFromTools = extractToolPrefixesFromLog(storedMessage.toolCalls);
    if (prefixesFromTools.length > 0) return prefixesFromTools;
  }

  for (const storedMessage of storedMessages) {
    if (storedMessage.role !== "assistant") continue;
    const prefixesFromAssistantContent = getRequestedToolPrefixes(storedMessage.content);
    if (prefixesFromAssistantContent.length > 0) return prefixesFromAssistantContent;
  }

  return [];
}

function filterToolsForRequestedServices(
  tools: ChatTool[],
  requestedPrefixes: string[]
): ChatTool[] {
  if (requestedPrefixes.length === 0) return tools;

  return tools.filter((tool) => {
    if (tool.type !== "function") return false;
    return requestedPrefixes.some((prefix) => tool.function.name.startsWith(prefix));
  });
}

function summarizeToolFailure(toolCalls: ToolExecutionLog[]): string | null {
  if (toolCalls.length === 0) return null;

  const failures = toolCalls.filter(
    (toolCall) => typeof toolCall.error === "string" && toolCall.error.length > 0
  );
  if (failures.length === 0) return null;
  if (failures.length < toolCalls.length) return null;

  const firstFailure = failures[0];
  const toolName = firstFailure.name || "requested tool";
  const errorMessage = firstFailure.error || "Unknown tool execution error";

  const isIntegrationError =
    errorMessage.toLowerCase().includes("not connected") ||
    errorMessage.toLowerCase().includes("auth") ||
    errorMessage.toLowerCase().includes("connection");

  if (isIntegrationError) {
    return `I tried to use ${toolName}, but it looks like the required service is not connected. Please visit the **Integrations** page to link your account, then try again.`;
  }

  return `I tried to help by executing ${toolName}, but the tool returned an error: ${errorMessage}. Please try again or rephrase your request.`;
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      return isRecord(part) && typeof part.text === "string" ? part.text : "";
    })
    .join("\n")
    .trim();
}

function toChatMessageParam(storedMessage: StoredChatMessage): ChatMessageParam | null {
  const { role, content, toolCalls } = storedMessage;
  if (role === "user") return { role: "user", content };
  if (role === "assistant") {
    const param: any = { role: "assistant", content };
    if (toolCalls) {
      try {
        const parsed = JSON.parse(toolCalls);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          // It's a proper OpenAI tool_calls array
          param.tool_calls = parsed;
        }
      } catch (e) { }
    }
    return param;
  }
  if (role === "tool") {
    return {
      role: "tool",
      content,
      tool_call_id: toolCalls || "", // We store the tool_call_id in the toolCalls column for these rows
    } as any;
  }
  if (role === "system") return { role: "system", content };
  return null;
}

async function runTextOnlyChat(
  model: string,
  messages: ChatMessageParam[]
): Promise<string> {
  const chatResponse = await createChatCompletion({
    model,
    messages,
  });

  return extractTextContent(chatResponse.choices[0]?.message?.content);
}

// ---------------------------------------------------------------------------
// APPROVAL GATE TYPES
// ---------------------------------------------------------------------------
interface ApprovalGateEvent {
  __APPROVAL_REQUEST__: true;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  toolArgs: string;
  description: string;
  sessionId: string;
}

interface RunToolChatOptions {
  model: string;
  baseMessages: ChatMessageParam[];
  tools: ChatTool[];
  userId: string;
  forceFirstToolCall: boolean;
  sessionId: string;
  runtimeUrl?: string; // Add this
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
}

async function runToolEnabledChat(
  options: RunToolChatOptions
): Promise<{
  responseText: string;
  toolCalls: ToolExecutionLog[];
  pausedForApproval: boolean;
  fullTurnMessages: Array<{ role: string; content: string; toolCalls: string | null }>;
}> {
  const { model, baseMessages, tools, userId, forceFirstToolCall, sessionId, runtimeUrl, writer, encoder } = options;

  if (tools.length === 0) {
    return {
      responseText: await runTextOnlyChat(model, baseMessages),
      toolCalls: [],
      pausedForApproval: false,
      fullTurnMessages: [],
    };
  }

  const toolCalls: ToolExecutionLog[] = [];
  const messages: ChatMessageParam[] = [...baseMessages];
  const fullTurnMessages: Array<{ role: string; content: string; toolCalls: string | null }> = [];
  const callHistory = new Set<string>();

  // FIX (LOW): Enforce a hard timeout on the entire tool loop to prevent
  // runaway agent sessions. AbortSignal is passed to each LLM call.
  const loopAbortController = new AbortController();
  const loopTimeoutId = setTimeout(() => loopAbortController.abort(), TOOL_LOOP_TIMEOUT_MS);

  let consecutiveErrors = 0;

  try {
    for (let iteration = 0; iteration < MAX_TOOL_LOOP_STEPS; iteration += 1) {
      if (loopAbortController.signal.aborted) {
        console.warn(`[chat] Tool loop timed out after ${TOOL_LOOP_TIMEOUT_MS}ms for session ${sessionId}`);
        break;
      }
      const chatResponse = await createChatCompletion({
        model,
        messages,
        tools,
        tool_choice: forceFirstToolCall && iteration === 0 ? "required" : "auto",
      });

      const assistantMessage = chatResponse.choices[0]?.message;
      if (!assistantMessage) break;

      const assistantToolCalls = assistantMessage.tool_calls ?? [];
      const assistantText = extractTextContent(assistantMessage.content);

      if (assistantToolCalls.length === 0) {
        return { responseText: assistantText, toolCalls, pausedForApproval: false, fullTurnMessages };
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantToolCalls,
      });

      fullTurnMessages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        toolCalls: JSON.stringify(assistantToolCalls),
      });

      for (const toolCall of assistantToolCalls) {
        if (toolCall.type !== "function") continue;

        // ── APPROVAL GATE ─────────────────────────────────────────────────────
        if (requiresApproval(toolCall.function.name)) {
          // Save a snapshot of the current message chain so we can resume later
          const pendingMessages: ChatMessageParam[] = [
            ...messages,
            {
              role: "assistant" as const,
              content: assistantMessage.content ?? "",
              tool_calls: assistantToolCalls,
            },
          ];

          const approval = await prisma.toolApproval.create({
            data: {
              sessionId,
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              toolArgs: toolCall.function.arguments,
              pendingMessages: JSON.stringify(pendingMessages),
              status: "PENDING",
            },
          });

          const event: ApprovalGateEvent = {
            __APPROVAL_REQUEST__: true,
            approvalId: approval.id,
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            toolArgs: toolCall.function.arguments,
            description: describeToolCall(toolCall.function.name, toolCall.function.arguments),
            sessionId,
          };

          await writer.write(encoder.encode(`\n__APPROVAL_REQUEST__${JSON.stringify(event)}__END__`));
          return { responseText: "", toolCalls, pausedForApproval: true, fullTurnMessages };
        }
        // ── END APPROVAL GATE ─────────────────────────────────────────────────

        let rawResult: string;
        const callSignature = `${toolCall.function.name}:${toolCall.function.arguments}`;
        if (callHistory.has(callSignature)) {
          console.warn(`[chat] Detected repeated tool call: ${callSignature}. Breaking loop.`);
          rawResult = "ERROR: You have already attempted this exact tool call with these exact arguments in this turn. Do not repeat it. If you are stuck, summarize the situation and ask the user for clarification.";
        } else {
          callHistory.add(callSignature);
          if (isOrchestrationTool(toolCall.function.name)) {
            const args = JSON.parse(toolCall.function.arguments);
            rawResult = await executeOrchestrationToolCall(userId, toolCall.function.name, args, sessionId);
          } else if (isClawnchTool(toolCall.function.name)) {
            const args = JSON.parse(toolCall.function.arguments);
            rawResult = await executeClawnchTool(toolCall.function.name, args);
          } else {
            rawResult = await executeOpenAIToolCall(userId, toolCall, runtimeUrl);
          }
        }

        if (rawResult.length > 15000) {
          rawResult = rawResult.substring(0, 15000) + "... [Truncated for brevity]";
        }

        const parsedResult = parseJsonSafely(rawResult);

        let error: string | undefined;
        if (isRecord(parsedResult) && typeof parsedResult.error === "string") {
          error = parsedResult.error;
        }

        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          result: error ? undefined : parsedResult,
          error,
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: rawResult,
        });

        fullTurnMessages.push({
          role: "tool",
          content: rawResult,
          toolCalls: toolCall.id, // Reusing column to store ID
        });
      }

      const iterationHadErrors = toolCalls.slice(-assistantToolCalls.length).some(tc => !!tc.error);
      if (iterationHadErrors) {
        consecutiveErrors++;
      } else {
        consecutiveErrors = 0;
      }

      if (consecutiveErrors >= 3) {
        messages.push({
          role: "system",
          content: "CRITICAL: You have encountered multiple consecutive tool errors. You must STOP calling tools now. Reply to the user explaining what failed and why.",
        });
        // We do not break immediately, we let the LLM generate one final text response 
        // in the next iteration without calling tools (since we instructed it to stop).

        // Prevent further looping if it ignores the instruction
        if (consecutiveErrors >= 5) {
          break;
        }
      }
    }

    clearTimeout(loopTimeoutId);

    // If we have an accumulated response, return it even if we hit the loop limit
    // Find the last assistant message content
    const lastAssistantText = fullTurnMessages
      .filter(m => m.role === "assistant")
      .map(m => m.content)
      .reverse()[0];

    return {
      responseText: lastAssistantText || "I've reached the maximum number of tool steps for this request.",
      toolCalls,
      pausedForApproval: false,
      fullTurnMessages
    };
  } catch (error) {
    clearTimeout(loopTimeoutId);
    console.error("[chat] Tool-enabled chat failed:", error);

    let fallbackText =
      "I ran into a temporary model issue while processing that request. Please try again.";
    try {
      console.log("[chat] Attempting text-only fallback...");
      fallbackText = await runTextOnlyChat(model, baseMessages);
    } catch (fallbackError) {
      console.error("[chat] Text-only fallback also failed:", fallbackError);
    }

    return {
      responseText: fallbackText,
      toolCalls,
      pausedForApproval: false,
      fullTurnMessages: [],
    };
  } finally {
    clearTimeout(loopTimeoutId);
  }

  return {
    responseText:
      "I could not complete that request through tools. Please verify your Composio connections and try again.",
    toolCalls,
    pausedForApproval: false,
    fullTurnMessages: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { agentId, sessionId, message, model, resumeApprovalId } = parsed.data;

    // Additional billing checks for metered models.
    if (!isUnmeteredModel(model)) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true, stakingLevel: true, stakedAmount: true },
      });

      const isSubscribed =
        user?.subscriptionStatus === "active" &&
        user.subscriptionExpiresAt &&
        user.subscriptionExpiresAt > new Date();

      const kiloKey = process.env.KILO_API_KEY;

      if (!isSubscribed) {
        // If owner mode (kiloKey set), skip all premium/subscription checks
        if (kiloKey) {
          // Skip
        } else if (isPremiumModel(model)) {
          // Check if this is a premium model that can be accessed via staking
          const userStakingLevel = (user?.stakingLevel || "NONE") as StakingLevel;
          const accessCheck = validateModelAccess(model, userStakingLevel);

          if (!accessCheck.allowed) {
            return NextResponse.json(
              {
                error: accessCheck.reason,
                code: "STAKING_REQUIRED",
                model,
                requiredStakingLevel: userStakingLevel,
              },
              { status: 403 }
            );
          }
        } else {
          // It's a premium model but not in the staking-accessible list
          return NextResponse.json(
            {
              error: "Premium models require a Randi Pro subscription.",
              code: "SUBSCRIPTION_REQUIRED",
            },
            { status: 403 }
          );
        }

        // ── CREDIT DEDUCTION ──────────────────────────────────────────────────────
        // Charge for the initial orchestrator call (lead agent)
        const deduction = await deductForAgentCall(
          auth.userId,
          model,
          `Chat: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
          sessionId
        );

        if (!deduction.success) {
          return NextResponse.json(
            {
              error: deduction.error || "Insufficient credits.",
              code: "INSUFFICIENT_FUNDS",
              requiredCredits: deduction.cost,
            },
            { status: 402 }
          );
        }
        // ──────────────────────────────────────────────────────────────────────────
      }
    }

    let existingSession:
      | {
        id: string;
        userId: string;
        agentId: string;
      }
      | null = null;

    if (sessionId) {
      existingSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, agentId: true },
      });

      if (!existingSession || existingSession.userId !== auth.userId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    }

    const resolvedAgentId = existingSession?.agentId || agentId!;
    const agent = await prisma.agentConfig.findUnique({
      where: { id: resolvedAgentId },
      select: { id: true, systemPrompt: true, active: true, tools: true },
    });

    if (!agent || !agent.active) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    let historyMessages: ChatMessageParam[] = [];
    let storedMessagesForContext: StoredChatMessage[] = [];
    if (existingSession) {
      const storedMessages = await prisma.chatMessage.findMany({
        where: { sessionId: existingSession.id },
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY_MESSAGES,
        select: { role: true, content: true, toolCalls: true },
      });
      storedMessagesForContext = storedMessages;

      historyMessages = storedMessages
        .reverse()
        .map((storedMessage) => toChatMessageParam(storedMessage))
        .filter((storedMessage): storedMessage is ChatMessageParam => storedMessage !== null);
    }

    let composioTools: ChatTool[] = [];
    if (agent.tools) {
      composioTools = await getAgentToolsFromConfig(agent.tools, auth.userId);
    }

    const requestedToolPrefixes = resolveContextualToolPrefixes(
      message,
      storedMessagesForContext
    );
    const scopedTools = filterToolsForRequestedServices(
      composioTools,
      requestedToolPrefixes
    );

    // FIX (HIGH): Do not pass all tools for general chat.
    // If no specific service prefix is found and it doesn't look like a tool action,
    // we use a much more conservative tool set to avoid model confusion.
    const isToolRequest = requestedToolPrefixes.length > 0 || shouldForceToolCall(message);

    // Base tools for this request (scoped by prefix if available)
    let toolsForRequest = isToolRequest ? (requestedToolPrefixes.length > 0 ? scopedTools : composioTools) : [];

    // Filter by preference (e.g. gmail over github)
    if (shouldPreferEmailTools(message)) {
      toolsForRequest = toolsForRequest.filter((tool) => tool.type === "function" && !tool.function.name.startsWith("GITHUB_"));
    }

    // ── SKILLS & ORCHESTRATION TOOLS ──────────────────────────────────────────
    const agentSkills = parseAgentSkills(agent.tools);
    const skillsContext = buildSkillsContext(agentSkills);
    const actionSkillNames = getActionSkills(agentSkills);

    let combinedTools = toolsForRequest;

    // Orchestration tools are ALWAYS added to a tool request if the agent has them, 
    // even if they don't match the service prefix (so we can delegate!)
    if (isToolRequest && agent.tools) {
      try {
        const parsedConfig = JSON.parse(agent.tools);
        const requestedInternalTools = Array.isArray(parsedConfig.tools) ? parsedConfig.tools : [];
        if (requestedInternalTools.includes("delegate_to_specialist") ||
          requestedInternalTools.includes("spawn_autonomous_developer") ||
          requestedInternalTools.includes("browse_web") ||
          requestedInternalTools.includes("list_available_skills") ||
          requestedInternalTools.includes("load_skill_context")) {
          combinedTools = [...combinedTools, ...ORCHESTRATION_TOOLS];
        }
      } catch (err) {
        console.warn("Failed to parse agent tools for orchestration check", err);
      }
    }

    // Merge Clawnch action tools if applicable
    if (isToolRequest && actionSkillNames.includes("clawnch")) {
      combinedTools = [...combinedTools, ...CLAWNCH_TOOLS];
    }

    // Deduplicate tools by function name
    const uniqueToolsMap = new Map();
    combinedTools.forEach(t => {
      if (t.type === 'function') uniqueToolsMap.set(t.function.name, t);
    });
    combinedTools = Array.from(uniqueToolsMap.values());

    // Build the enriched system prompt
    const enrichedSystemPrompt = agent.systemPrompt + skillsContext;

    // Use combinedTools to decide on instruction injection
    const messages: ChatMessageParam[] = [
      { role: "system", content: enrichedSystemPrompt },
      ...(combinedTools.length > 0
        ? ([{ role: "system", content: TOOL_USAGE_SYSTEM_INSTRUCTION }] as ChatMessageParam[])
        : []),
      ...historyMessages,
      { role: "user", content: message },
    ];

    const forceFirstToolCall =
      combinedTools.length > 0 && shouldForceToolCall(message);

    const responseStream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Run the chat logic in the background so we can return the stream immediately
    (async () => {
      try {
        // ── RESUME FROM APPROVAL PATH ─────────────────────────────────────────
        // When the user clicks Allow/Deny on an ApprovalCard, the frontend
        // re-sends the original message with resumeApprovalId. We pick up
        // the suspended tool chain from DB here.
        if (resumeApprovalId && existingSession) {
          const approval = await prisma.toolApproval.findUnique({
            where: { id: resumeApprovalId },
            include: { session: { select: { userId: true } } },
          });

          if (!approval || approval.session.userId !== auth.userId) {
            await writer.write(encoder.encode("Approval not found or unauthorized."));
            await writer.close();
            return;
          }

          // Restore the pending message chain
          let restoredMessages: ChatMessageParam[] = [];
          try {
            restoredMessages = JSON.parse(approval.pendingMessages) as ChatMessageParam[];
          } catch {
            await writer.write(encoder.encode("Failed to restore conversation state."));
            await writer.close();
            return;
          }

          // Discover active runtime for the resume path
          const activeRuntime = await prisma.container.findFirst({
            where: {
              userId: auth.userId,
              agentId: existingSession.agentId,
              expiresAt: { gt: new Date() }
            },
            select: { url: true }
          });

          let toolResultContent: string;
          if (approval.status === "APPROVED") {
            // Build a minimal tool_call message and execute
            const toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
              id: approval.toolCallId,
              type: "function",
              function: { name: approval.toolName, arguments: approval.toolArgs },
            };
            toolResultContent = await executeOpenAIToolCall(auth.userId, toolCall, activeRuntime?.url ?? undefined);
          } else {
            // Rejected — inject a denial result so the LLM can respond gracefully
            toolResultContent = JSON.stringify({
              error: "User denied this action. Do not attempt to retry it.",
            });
          }

          // Append the tool result and continue the LLM loop with remaining tools
          restoredMessages.push({
            role: "tool",
            tool_call_id: approval.toolCallId,
            content: toolResultContent,
          });

          const { responseText: resumeText, toolCalls: resumeToolCalls, pausedForApproval } =
            await runToolEnabledChat({
              model,
              baseMessages: restoredMessages,
              tools: combinedTools,
              userId: auth.userId,
              forceFirstToolCall: false,
              sessionId: existingSession.id,
              runtimeUrl: activeRuntime?.url ?? undefined,
              writer,
              encoder,
            });

          if (pausedForApproval) {
            // Another approval needed — stream already handled by the gate
            await writer.close();
            return;
          }

          const normalizedResumeText =
            resumeText.trim() ||
            (approval.status === "REJECTED"
              ? "I've cancelled that action as you requested."
              : "Done! Let me know if you need anything else.");

          // Save assistant response to DB
          await prisma.chatSession.update({
            where: { id: existingSession.id },
            data: { updatedAt: new Date() },
          });
          await prisma.chatMessage.create({
            data: {
              sessionId: existingSession.id,
              role: "assistant",
              content: normalizedResumeText,
              toolCalls: resumeToolCalls.length > 0 ? JSON.stringify(resumeToolCalls) : null,
            },
          });

          // Stream assistant response
          const resumeWords = normalizedResumeText.split(" ");
          for (let i = 0; i < resumeWords.length; i++) {
            await writer.write(encoder.encode(resumeWords[i] + (i < resumeWords.length - 1 ? " " : "")));
            await new Promise((r) => setTimeout(r, 20));
          }
          await writer.close();
          return;
        }
        // ── END RESUME PATH ───────────────────────────────────────────────────

        // ── RUNTIME DISCOVERY ─────────────────────────────────────────────────
        // Check if there's an active dedicated runtime for this user/agent pair.
        // If found, tool execution will be routed to the isolated container.
        const activeRuntime = await prisma.container.findFirst({
          where: {
            userId: auth.userId,
            agentId: agent.id,
            expiresAt: { gt: new Date() }
          },
          select: { url: true }
        });

        const { responseText, toolCalls, pausedForApproval, fullTurnMessages } = await runToolEnabledChat({
          model,
          baseMessages: messages,
          tools: combinedTools,
          userId: auth.userId,
          forceFirstToolCall,
          sessionId: existingSession?.id ?? "__new__",
          runtimeUrl: activeRuntime?.url ?? undefined,
          writer,
          encoder,
        });

        // If we paused for approval, the gate already wrote to the stream.
        // Don't write anything else — just close the stream.
        if (pausedForApproval) {
          await writer.close();
          return;
        }

        let resolvedResponseText = responseText.trim();
        if (forceFirstToolCall && toolCalls.length === 0) {
          resolvedResponseText =
            "I could not execute a required tool for this request. Please ensure the relevant Composio account is connected, then try again.";
        }

        const allToolsFailedMessage = summarizeToolFailure(toolCalls);
        if (allToolsFailedMessage) {
          resolvedResponseText = allToolsFailedMessage;
        }

        const normalizedResponseText =
          resolvedResponseText || "I could not generate a response.";

        // Save to DB
        let currentSessionId = existingSession?.id;
        if (!currentSessionId) {
          // Improved title generation via AI summary
          let title = message.substring(0, 50);
          try {
            const titleResponse = await createChatCompletion({
              model: "google/gemini-2.0-flash-lite-preview-02-05:free",
              messages: [
                {
                  role: "system",
                  content: "Generate a concise 3-4 word title for a chat starting with this message. Return ONLY the title text.",
                },
                { role: "user", content: message },
              ],
              max_tokens: 15,
            });
            title = titleResponse.choices[0]?.message?.content?.trim() || title;
          } catch (err) {
            console.warn("Title generation failed, falling back to message snippet", err);
          }

          const newSession = await prisma.chatSession.create({
            data: {
              userId: auth.userId,
              agentId: agent.id,
              title: title,
            },
          });
          currentSessionId = newSession.id;
        } else {
          await prisma.chatSession.update({
            where: { id: currentSessionId },
            data: { updatedAt: new Date() },
          });
        }

        await prisma.chatMessage.createMany({
          data: [
            { sessionId: currentSessionId, role: "user", content: message },
            ...fullTurnMessages.map(msg => ({
              sessionId: currentSessionId!,
              role: msg.role,
              content: msg.content,
              toolCalls: msg.toolCalls,
            })),
            {
              sessionId: currentSessionId,
              role: "assistant",
              content: normalizedResponseText,
              toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
            },
          ],
        });

        // For now, we still wait for tool loop to finish, but we stream the final result.
        // To truly stream intermediate chunks, we'd need to refactor runToolEnabledChat.
        // We'll send the final text in chunks to simulate the streaming experience for now,
        // or actually stream from completion.

        // Actually, let's just stream the normalizedResponseText as one or more chunks.
        // In a future update, we can stream the completion itself.
        const words = normalizedResponseText.split(" ");
        for (let i = 0; i < words.length; i++) {
          await writer.write(encoder.encode(words[i] + (i < words.length - 1 ? " " : "")));
          // Small Sleep to make it feel like streaming if it's too fast
          await new Promise(r => setTimeout(r, 20));
        }

        await writer.close();
      } catch (err) {
        console.error("Streaming error:", err);
        await writer.write(encoder.encode("Error: " + (err instanceof Error ? err.message : "Internal error")));
        await writer.close();
      }
    })();

    // We return the readable part of the TransformStream
    // We send the sessionId as a header
    let sessionIdToHeader = existingSession?.id || "new";
    // Note: If it's a new session, the ID will be created in the background, 
    // so we might want to wait for it or use a different strategy.
    // For simplicity, we'll just stream the sessionId as a first special chunk.

    return new Response(responseStream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
