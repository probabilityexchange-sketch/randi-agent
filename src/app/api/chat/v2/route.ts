import { aiOpenRouter } from "@/lib/ai/openrouter";
import { streamText, tool, generateText, stepCountIs, type ToolSet, type ModelMessage } from "ai";
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
import { getComposioClient, executeOpenAIToolCall, resolveComposioUserId } from "@/lib/composio/client";
import { VercelProvider } from "@composio/vercel";
import { DEFAULT_MODEL, isUnmeteredModel } from "@/lib/openrouter/client";
import { deductForAgentCall } from "@/lib/credits/engine";
import {
    validateModelAccess,
    isPremiumModel,
    type StakingLevel
} from "@/lib/token-gating";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

// Input schema
const schema = z.object({
    agentId: z.string().optional(),
    agentSlug: z.string().optional(),
    sessionId: z.string().optional(),
    message: z.string().min(1).max(4000),
    model: z.string().min(1).default(DEFAULT_MODEL),
});

const MAX_HISTORY = 10;

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`chat-v2:${auth.userId}`, RATE_LIMITS.chat);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const { agentId, agentSlug, sessionId, message, model } = schema.parse(body);

        // 1. Billing & Access Checks
        if (!isUnmeteredModel(model)) {
            const deduction = await deductForAgentCall(auth.userId, model, `Chat V2: ${message.substring(0, 50)}`, sessionId);
            if (!deduction.success) {
                return NextResponse.json({ error: deduction.error || "Insufficient credits.", code: "INSUFFICIENT_FUNDS" }, { status: 402 });
            }
        }

        // 2. Fetch Agent Config
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

        const resolvedAgentId = existingSession?.agentId || agentId;

        const agent = resolvedAgentId ? await prisma.agentConfig.findUnique({
            where: { id: resolvedAgentId },
        }) : (agentSlug ? await prisma.agentConfig.findUnique({
            where: { slug: agentSlug },
        }) : null);

        if (!agent || !agent.active) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

        // 3. Prepare Tools
        const tools: ToolSet = {};

        // Load Tools for V2
        const composioClient = await getComposioClient();
        if (composioClient && agent.tools) {
            const parsed = JSON.parse(agent.tools);
            const resolvedUserId = resolveComposioUserId(auth.userId);

            // Fetch tools from Composio Core Client
            const composioTools = await composioClient.tools.get(resolvedUserId, {
                toolkits: parsed.toolkits,
                tools: parsed.tools
            });

            // Discover active runtime for container isolation
            const activeRuntime = await prisma.container.findFirst({
                where: {
                    userId: auth.userId,
                    agentId: agent.id,
                    expiresAt: { gt: new Date() }
                },
                select: { url: true }
            });

            // Wrap them for Vercel AI SDK
            const vercelProvider = new VercelProvider();
            const rawTools = (Array.isArray(composioTools) ? composioTools : [composioTools]).map((t: any) => ({
                ...t,
                slug: t.slug || (t.function?.name) || t.name,
                name: t.name || (t.function?.name) || t.slug,
                description: t.description || t.function?.description,
                inputParameters: t.inputParameters || t.function?.parameters
            }));

            const wrappedComposioTools = vercelProvider.wrapTools(
                rawTools as any,
                async (toolSlug, args) => {
                    // executeOpenAIToolCall returns a JSON string; Composio's ExecuteToolFn
                    // expects { data, error, successful } so we parse and reshape it.
                    const toolCall = {
                        id: `v2_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'function' as const,
                        function: {
                            name: toolSlug,
                            arguments: JSON.stringify(args)
                        }
                    };
                    const resultStr = await executeOpenAIToolCall(auth.userId, toolCall, activeRuntime?.url ?? undefined);
                    let parsed: Record<string, unknown>;
                    try { parsed = JSON.parse(resultStr); } catch { parsed = { result: resultStr }; }
                    const isError = parsed && typeof parsed === 'object' && 'error' in parsed;
                    return {
                        data: isError ? {} as Record<string, unknown> : parsed as Record<string, unknown>,
                        error: isError ? String(parsed.error) : null,
                        successful: !isError,
                    };
                }
            );
            Object.assign(tools, wrappedComposioTools);
        }

        // Add Orchestration Tools
        ORCHESTRATION_TOOLS.forEach(ot => {
            if (ot.type !== 'function') return;
            (tools as any)[ot.function.name] = tool({
                description: ot.function.description,
                inputSchema: z.any(), // Since we already have the definitions in orchestration/tools.ts
                execute: async (args: any) => {
                    return await executeOrchestrationToolCall(auth.userId, ot.function.name, args, sessionId || "v2-session");
                }
            });
        });

        // Add Clawnch Tools
        CLAWNCH_TOOLS.forEach(ct => {
            if (ct.type !== 'function') return;
            (tools as any)[ct.function.name] = tool({
                description: ct.function.description,
                inputSchema: z.any(),
                execute: async (args: any) => {
                    return await executeClawnchTool(ct.function.name, args);
                }
            });
        });

        // 4. Load History
        const history: ModelMessage[] = [];
        if (existingSession) {
            const stored = await prisma.chatMessage.findMany({
                where: { sessionId: existingSession.id },
                orderBy: { createdAt: 'desc' },
                take: MAX_HISTORY,
                select: { role: true, content: true }
            });
            stored.reverse().forEach(m => {
                if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
                    history.push({ role: m.role as 'user' | 'assistant' | 'system', content: m.content });
                }
            });
        }

        // 5. Run streamText
        let finalSystemPrompt = agent.systemPrompt || "";

        // Minimax-specific model hardening
        if (model.toLowerCase().includes("minimax")) {
            return handleNonStandardChat({
                auth,
                model,
                agent,
                message,
                history,
                tools,
                sessionId,
            });
        }

        const result = streamText({
            model: aiOpenRouter(model),
            system: finalSystemPrompt,
            messages: [
                ...history,
                { role: 'user', content: message }
            ],
            tools,
            stopWhen: stepCountIs(10),
            onFinish: async ({ text, toolCalls, toolResults }) => {
                // Persistence logic
                let currentSessionId = existingSession?.id;
                if (!currentSessionId) {
                    // Ported title generation via AI
                    let title = message.substring(0, 50);
                    try {
                        const { text: titleText } = await generateText({
                            model: aiOpenRouter("google/gemini-2.0-flash-lite-preview-02-05:free"),
                            system: "Generate a concise 3-4 word title for a chat starting with this message. Return ONLY the title text.",
                            prompt: message,
                        });
                        title = titleText.trim() || title;
                    } catch (err) {
                        console.warn("Title generation failed in V2, falling back to snippet", err);
                    }

                    const newSession = await prisma.chatSession.create({
                        data: {
                            userId: auth.userId,
                            agentId: agent.id,
                            title: title
                        }
                    });
                    currentSessionId = newSession.id;
                }

                // Save User Message
                await prisma.chatMessage.create({
                    data: {
                        sessionId: currentSessionId,
                        role: 'user',
                        content: message
                    }
                });

                // Save Assistant Message
                await prisma.chatMessage.create({
                    data: {
                        sessionId: currentSessionId,
                        role: 'assistant',
                        content: text,
                        toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
                    }
                });
            }
        });

        return result.toUIMessageStreamResponse();

    } catch (error) {
        console.error("Chat V2 Error:", error);
        return handleAuthError(error);
    }
}
