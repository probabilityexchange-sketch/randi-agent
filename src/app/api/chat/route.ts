import { aiOpenRouter } from "@/lib/ai/openrouter";
import { streamText, tool, stepCountIs, type ToolSet, type ModelMessage } from "ai";
import { handleNonStandardChat } from "@/lib/ai/resilience";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { z } from "zod";
import {
  ORCHESTRATION_TOOLS,
  executeOrchestrationToolCall,
  isOrchestrationTool
} from "@/lib/orchestration/tools";
import {
  CLAWNCH_TOOLS,
  executeClawnchTool,
  isClawnchTool
} from "@/lib/skills/clawnch-tools";
import { getComposioClient, executeOpenAIToolCall, resolveComposioUserId, getAgentToolsFromConfig } from "@/lib/composio/client";
import { VercelProvider } from "@composio/vercel";
import { getRandiContext } from "@/lib/randi/context";
import { DEFAULT_MODEL, isUnmeteredModel } from "@/lib/openrouter/client";
import { deductForAgentCall } from "@/lib/credits/engine";
import {
  validateModelAccess,
  isPremiumModel,
  type StakingLevel
} from "@/lib/token-gating";
import { requiresApproval, describeToolCall } from "@/lib/composio/approval-rules";
import { parseAgentSkills, buildSkillsContext } from "@/lib/skills/loader";
import { KILO_COMPOSIO_CHEAT_SHEET } from "@/lib/skills/tool-cheat-sheet";

// ---------------------------------------------------------------------------
// CONFIG & SCHEMAS
// ---------------------------------------------------------------------------

const MAX_HISTORY = 40;
const MAX_STEPS = 10;

const schema = z.object({
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.string().max(4000).optional(),
  messages: z.array(z.any()).optional(),
  model: z.string().min(1).default(DEFAULT_MODEL),
  resumeApprovalId: z.string().optional(),
});

const TOOL_USAGE_SYSTEM_INSTRUCTION =
  "You have access to tools for external services. If the user's request requires a tool (e.g. GitHub, Slack, Gmail), call the matching tool. If a tool returns an error, DO NOT retry the same call—explain the issue. For general knowledge or conversational requests, do NOT attempt to use tools. Never simulate tool results.\n\n" + KILO_COMPOSIO_CHEAT_SHEET;

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function shouldForceToolCall(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsService = /\b(github|git|repo|repository|slack|chat|notion|doc|page|gmail|email|mail|inbox|mailbox|google sheets|googlesheets|sheets|spreadsheet|excel|calendar|google calendar|gcal|supabase|db|database|vercel|deploy|hacker ?news|hn|prompmate|promptmate|coinmarketcap|coin market cap|cmc|telegram|tg)\b/.test(normalized);
  const mentionsAction = /\b(connect|list|show|get|find|search|create|update|delete|send|post|write|read|use|check|sync|pull|push|commit|deploy|add|remove)\b/.test(normalized);
  return mentionsService && mentionsAction;
}

// ---------------------------------------------------------------------------
// MAIN ROUTE
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { agentId, sessionId, model, resumeApprovalId } = parsed.data;

    // Extract message content from either 'message' or 'messages' array
    let message = parsed.data.message || "";
    if (!message && parsed.data.messages && parsed.data.messages.length > 0) {
      const lastMsg = parsed.data.messages[parsed.data.messages.length - 1];
      if (lastMsg.role === "user") {
        if (typeof lastMsg.content === "string") {
          message = lastMsg.content;
        } else if (Array.isArray(lastMsg.parts)) {
          message = lastMsg.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("");
        }
      }
    }

    if (!message && !resumeApprovalId) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Billing & Access Checks
    const resolvedModel = model || DEFAULT_MODEL;
    const kiloKey = process.env.KILO_API_KEY;
    if (!isUnmeteredModel(resolvedModel) && !kiloKey) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true, stakingLevel: true },
      });

      const isSubscribed =
        user?.subscriptionStatus === "active" &&
        user.subscriptionExpiresAt &&
        user.subscriptionExpiresAt > new Date();

      if (!isSubscribed) {
        if (isPremiumModel(resolvedModel)) {
          const userStakingLevel = (user?.stakingLevel || "NONE") as StakingLevel;
          const accessCheck = validateModelAccess(resolvedModel, userStakingLevel);
          if (!accessCheck.allowed) {
            return NextResponse.json({ error: accessCheck.reason, code: "STAKING_REQUIRED" }, { status: 403 });
          }
        } else {
          return NextResponse.json({ error: "Premium models require a Randi Pro subscription.", code: "SUBSCRIPTION_REQUIRED" }, { status: 403 });
        }
      }

      const deduction = await deductForAgentCall(auth.userId, resolvedModel, `Chat: ${message.substring(0, 50)}`, sessionId);
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || "Insufficient credits.", code: "INSUFFICIENT_FUNDS" }, { status: 402 });
      }
    }

    // 2. Resolve Agent Config & Session
    let existingSession = null;
    if (sessionId) {
      existingSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { id: true, agentId: true, userId: true }
      });
      if (!existingSession || existingSession.userId !== auth.userId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    }

    const resolvedAgentSelector = existingSession?.agentId || agentId || "randi-lead";
    const agent = await prisma.agentConfig.findFirst({
      where: {
        OR: [
          { id: resolvedAgentSelector },
          { slug: resolvedAgentSelector }
        ]
      },
      select: { id: true, slug: true, systemPrompt: true, active: true, tools: true },
    });

    if (!agent || !agent.active) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // 3. Prepare Tools
    const tools: ToolSet = {};
    const agentSkills = parseAgentSkills(agent.tools);
    const skillsContext = buildSkillsContext(agentSkills);

    // Composio Tools Integration
    if (agent.tools) {
      console.log(`[Chat] Agent tools config: ${agent.tools?.substring(0, 200)}`);
      const composioTools = await getAgentToolsFromConfig(agent.tools, auth.userId);
      console.log(`[Chat] Composio returned ${composioTools.length} tools`);
      if (composioTools.length > 0) {
        console.log(`[Chat] Tool names: ${composioTools.map((t) => t.slug).join(', ')}`);
      }
      const activeRuntime = await prisma.container.findFirst({
        where: { userId: auth.userId, agentId: agent.id, expiresAt: { gt: new Date() } },
        select: { url: true }
      });

      const vercelProvider = new VercelProvider();

      const wrappedComposioTools = vercelProvider.wrapTools(
        composioTools,
        async (toolSlug, args) => {
          // Approval Gate Check - use a clean separator
          if (requiresApproval(toolSlug)) {
            throw new Error(`APPROVAL_REQUIRED|${toolSlug}|${JSON.stringify(args)}`);
          }

          const resultStr = await executeOpenAIToolCall(auth.userId, {
            name: toolSlug,
            arguments: args,
          }, activeRuntime?.url || undefined);

          let parsed: any;
          try { 
            parsed = JSON.parse(resultStr); 
          } catch { 
            parsed = { data: { result: resultStr }, successful: true, error: null }; 
          }
          
          // Optimization: Clean up verbose Gmail/Calendar results to save tokens
          if (parsed.data && typeof parsed.data === 'object') {
            const data = parsed.data;
            if (Array.isArray(data.messages)) {
              data.messages = data.messages.map((msg: any) => ({
                id: msg.messageId || msg.id,
                from: msg.from || (msg.payload?.headers?.find((h: any) => h.name === 'From')?.value),
                subject: msg.subject || (msg.payload?.headers?.find((h: any) => h.name === 'Subject')?.value),
                date: msg.messageTimestamp || msg.date,
                snippet: msg.snippet || msg.messageText?.substring(0, 300),
              }));
            }
            if (Array.isArray(data.items)) { // Calendar items
              data.items = data.items.map((item: any) => ({
                id: item.id,
                summary: item.summary,
                start: item.start,
                end: item.end,
                location: item.location,
              }));
            }
          }

          // Return the parsed result directly - it already has { data, error, successful }
          return parsed;
        }
      );
      console.log(`[Chat] Wrapped Composio tools: ${Object.keys(wrappedComposioTools).length} -> ${Object.keys(wrappedComposioTools).join(', ')}`);
      Object.assign(tools, wrappedComposioTools);
    }

    // Add Orchestration & Clawnch Tools
    ORCHESTRATION_TOOLS.forEach(ot => {
      if (ot.type !== 'function') return;
      (tools as any)[ot.function.name] = tool({
        description: ot.function.description,
        inputSchema: z.any(),
        execute: async (args: any) => executeOrchestrationToolCall(auth.userId, ot.function.name, args, sessionId || "internal"),
      });
    });

    CLAWNCH_TOOLS.forEach(ct => {
      if (ct.type !== 'function') return;
      (tools as any)[ct.function.name] = tool({
        description: ct.function.description,
        inputSchema: z.any(),
        execute: async (args: any) => executeClawnchTool(ct.function.name, args),
      });
    });

    // 4. Load History or Resume Approval
    let history: ModelMessage[] = [];
    if (resumeApprovalId) {
      const approval = await prisma.toolApproval.findUnique({
        where: { id: resumeApprovalId },
      });
      if (approval && approval.pendingMessages) {
        const baseHistory = JSON.parse(approval.pendingMessages) as ModelMessage[];

        // Construct the result of the tool call that was paused
        const toolResult: ModelMessage = {
          role: "tool",
          content:
            approval.status === "APPROVED"
              ? await executeOpenAIToolCall(auth.userId, {
                  name: approval.toolName,
                  arguments: approval.toolArgs,
                })
              : JSON.stringify({
                error:
                  "User REJECTED this tool call. Do NOT attempt it again. Ask the user for alternative instructions.",
              }),
          toolCallId: approval.toolCallId,
        } as any;

        history = [...baseHistory, toolResult];
      }
    } else if (existingSession) {
      const stored = await prisma.chatMessage.findMany({
        where: { sessionId: existingSession.id },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY,
        select: { role: true, content: true, toolCalls: true }
      });
      stored.reverse().forEach(m => {
        if (m.role === 'tool' && m.toolCalls) {
          history.push({ role: 'tool', content: m.content, toolCallId: m.toolCalls } as any);
        } else if (m.role === 'assistant') {
          history.push({ 
            role: 'assistant', 
            content: m.content, 
            toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined 
          } as any);
        } else if (m.role === 'user' || m.role === 'system') {
          history.push({ role: m.role as any, content: m.content });
        }
      });
    }

    // 5. Run Stream Text
    const randiContext = await getRandiContext();

    // Fetch User-specific agent preferences
    const userPreference = await prisma.userAgentPreference.findUnique({
      where: {
        userId_agentSlug: {
          userId: auth.userId,
          agentSlug: agent.slug,
        },
      },
    }).catch(() => null);

    let userCustomContext = "";
    if (userPreference) {
      if (userPreference.personality) userCustomContext += `\n\n# USER CUSTOM PERSONALITY\n${userPreference.personality}\n`;
      if (userPreference.rules) userCustomContext += `\n\n# USER CUSTOM RULES\n${userPreference.rules}\n`;
      if (userPreference.skills) userCustomContext += `\n\n# USER CUSTOM SKILLS\n${userPreference.skills}\n`;
    }

    console.log(`[Chat] FINAL tool count: ${Object.keys(tools).length} -> ${Object.keys(tools).join(', ')}`);
    let finalSystemPrompt = agent.systemPrompt + "\n\n" + randiContext + userCustomContext + "\n\n" + skillsContext + (tools ? "\n\n" + TOOL_USAGE_SYSTEM_INSTRUCTION : "");

    // Minimax-specific model hardening:
    // Some gateways/models like minimax-m2.5 default to XML for tool calls, 
    // which streamText does NOT yet handle automatically. We use our Resilience Loop.
    if (resolvedModel.toLowerCase().includes("minimax")) {
      return handleNonStandardChat({
        auth,
        model: resolvedModel,
        agent,
        message,
        history,
        tools,
        sessionId,
      });
    }

    const result = streamText({
      model: aiOpenRouter(resolvedModel),
      system: finalSystemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message }
      ],
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      onFinish: async ({ text, toolCalls }) => {
        // Background persistence
        let currentSessionId = existingSession?.id;
        if (!currentSessionId) {
          const newSession = await prisma.chatSession.create({
            data: {
              userId: auth.userId,
              agentId: agent.id,
              title: message.substring(0, 50)
            }
          });
          currentSessionId = newSession.id;
        }

        await prisma.chatMessage.createMany({
          data: [
            { sessionId: currentSessionId, role: 'user', content: message },
            { sessionId: currentSessionId, role: 'assistant', content: text, toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null }
          ]
        });
      }
    });

    // Custom stream wrapper to handle HITL and special events if needed.
    // For now, we return the standard Text stream.
    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Main Chat Route Error:", error);

    // Handle specialized Approval Signal
    if (error.message?.startsWith("APPROVAL_REQUIRED|")) {
      const [_, toolName, argsJson] = error.message.split("|");
      
      return NextResponse.json({
        error: "Approval required",
        code: "APPROVAL_REQUIRED",
        toolName,
        args: JSON.parse(argsJson || "{}"),
        description: describeToolCall(toolName, argsJson)
      }, { status: 202 });
    }

    return handleAuthError(error);
  }
}
