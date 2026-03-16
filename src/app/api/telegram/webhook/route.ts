import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createChatCompletion } from "@/lib/openrouter/client";
import { executeOrchestrationToolCall, ORCHESTRATION_TOOLS, formatSpecialistResponse } from "@/lib/orchestration/tools";
import { getAgentToolsFromConfig, composioToolsToOpenAI, executeOpenAIToolCall } from "@/lib/composio/client";
import { getRandiContext } from "@/lib/randi/context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import type OpenAI from "openai";

type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

// This is a simple webhook handler for Telegram.
// In a production app, you'd want to verify the X-Telegram-Bot-Api-Secret-Token header.
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");

        if (!token) {
            console.error("[Telegram Webhook] Error: No token provided in URL");
            return NextResponse.json({ error: "No token" }, { status: 400 });
        }

        const { allowed } = await checkRateLimit(`telegram:${token}`, RATE_LIMITS.chat);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const message = body.message;
        if (!message || !message.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const text = message.text;
        const telegramUserId = message.from.id.toString();

        if (text === "/start") {
            const greeting = "✨ *Welcome to Randi Control Center!* ✨\n\nI'm securely connected to your Randi Platform account. You can now command me right from your phone!\n\nTry asking me to:\n📬 Fetch your latest emails\n📅 Check your Google Calendar\n💰 Get live crypto prices from CoinMarketCap\n🐙 Check issue statuses on GitHub\n\nWhat can I help you with today?";
            await sendMessage(chatId, greeting, token);
            return NextResponse.json({ ok: true });
        }

        // 1. Find user by their bot token
        const user = await prisma.user.findUnique({
            where: { telegramBotToken: token }
        });

        if (!user) {
            console.error(`[Telegram Webhook] Error: User not found for token ${token}`);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Link the telegramId if not already set, for faster lookups later
        if (user.telegramId !== telegramUserId) {
            await prisma.user.update({
                where: { id: user.id },
                data: { telegramId: telegramUserId }
            });
        }

        // 2. Load Randi (Lead Orchestrator)
        const agent = await prisma.agentConfig.findUnique({
            where: { slug: "randi-lead" }
        });

        if (!agent) {
            await sendMessage(chatId, "Error: Lead Orchestrator 'randi-lead' not found.", token);
            return NextResponse.json({ ok: true });
        }

        // ── CREDIT DEDUCTION ──────────────────────────────────────────────────────
        // Charge for the Lead Orchestrator call
        const { deductForAgentCall } = await import("@/lib/credits/engine");
        const deduction = await deductForAgentCall(
            user.id,
            agent.defaultModel,
            `Telegram: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`
        );

        if (!deduction.success) {
            await sendMessage(chatId, `⚠️ Insufficient credits to process your request. Required: ${deduction.cost} $RANDI. Please top up on the dashboard.`, token);
            return NextResponse.json({ ok: true });
        }
        // ──────────────────────────────────────────────────────────────────────────

        // 3. Process with Randi
        const responseText = await processWithRandi(user.id, agent, text, token);

        // 4. Reply
        await sendMessage(chatId, responseText, token);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[Telegram Webhook] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

async function processWithRandi(userId: string, agent: any, query: string, token: string) {
    let tools: ChatTool[] = [];
    if (agent.tools) {
        try {
            const composioTools = await getAgentToolsFromConfig(agent.tools, userId);
            tools = composioToolsToOpenAI(composioTools);
        } catch (err) {
            console.warn("[Telegram] Failed to fetch tools", err);
        }
    }

    // Always include orchestration tools for delegation
    const combinedTools = [...tools, ...ORCHESTRATION_TOOLS];

    const randiContext = await getRandiContext();
    const userPreference = await prisma.userAgentPreference.findUnique({
        where: {
            userId_agentSlug: {
                userId: userId,
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

    const finalSystemPrompt = agent.systemPrompt + "\n\n" + randiContext + userCustomContext;

    const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: query }
    ];

    try {
        let currentMessages = [...messages];
        let lastContent = "I'm sorry, I couldn't process that.";

        for (let i = 0; i < 5; i++) {
            const response = await createChatCompletion({
                model: agent.defaultModel,
                messages: currentMessages as any,
                tools: combinedTools.length > 0 ? combinedTools : undefined,
            });

            const assistantMessage = response.choices?.[0]?.message;
            if (!assistantMessage) break;

            currentMessages.push(assistantMessage as any);
            lastContent = assistantMessage.content || lastContent;

            let toolCalls = assistantMessage.tool_calls || [];

            // --- LLM Resilience: Capture raw JSON tool calls from content ---
            if (toolCalls.length === 0 && assistantMessage.content) {
                let textContent = assistantMessage.content.trim();
                // Strip markdown code blocks if the model wrapped the JSON in them
                if (textContent.startsWith('```')) {
                    const firstNewline = textContent.indexOf('\n');
                    const lastBacktick = textContent.lastIndexOf('```');
                    if (firstNewline !== -1 && lastBacktick !== -1 && lastBacktick > firstNewline) {
                        textContent = textContent.substring(firstNewline + 1, lastBacktick).trim();
                    }
                }

                if (textContent.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(textContent);
                        const parsedName = parsed.name || parsed.tool_name || parsed.function;
                        const parsedArgs = parsed.parameters || parsed.arguments || parsed.args || {};
                        if (typeof parsedName === 'string') {
                            toolCalls = [{
                                id: `call_${Math.random().toString(36).substring(2, 9)}`,
                                type: 'function',
                                function: {
                                    name: parsedName.replace(/\./g, '_'),
                                    arguments: typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs)
                                }
                            }];
                            // We caught a tool call hidden in the text. Don't show the user the raw JSON text.
                            lastContent = "Processing your request...";
                            assistantMessage.tool_calls = toolCalls; // Mutate for history
                        }
                    } catch {
                        // Not valid JSON, ignore
                    }
                }
            }

            if (toolCalls && toolCalls.length > 0) {
                const toolResults = await Promise.all(
                    toolCalls.map(async (tc) => {
                        let result = "Unsupported tool type.";

                        // Type-safe check for 'function' tool calls
                        if (tc.type === 'function' && tc.function) {
                            const rawFunctionName = (tc.function.name || "").replace(/\./g, '_');
                            tc.function.name = rawFunctionName;

                            const isOrch = ORCHESTRATION_TOOLS.some((t: any) =>
                                t.type === 'function' && t.function?.name === rawFunctionName
                            );

                            if (isOrch) {
                                try {
                                    result = await executeOrchestrationToolCall(
                                        userId,
                                        rawFunctionName,
                                        JSON.parse(tc.function.arguments),
                                        "telegram-session"
                                    );
                                } catch (err: any) {
                                    result = `Execution failed: ${err.message}`;
                                }
                            } else {
                                // Native tools (Gmail, etc.) via Composio/OpenAI wrapper
                                try {
                                    const resultStr = await executeOpenAIToolCall(userId, tc as any);
                                    let parsed: any;
                                    try { 
                                        parsed = JSON.parse(resultStr); 
                                    } catch { 
                                        parsed = { data: { result: resultStr }, successful: true }; 
                                    }

                                    // Clean up verbose results for Telegram (save data/tokens)
                                    if (parsed.data && typeof parsed.data === 'object') {
                                        const data = parsed.data;
                                        if (Array.isArray(data.messages)) {
                                            data.messages = data.messages.map((msg: any) => ({
                                                from: msg.from || (msg.payload?.headers?.find((h: any) => h.name === 'From')?.value),
                                                subject: msg.subject || (msg.payload?.headers?.find((h: any) => h.name === 'Subject')?.value),
                                                snippet: msg.snippet || msg.messageText?.substring(0, 150),
                                            })).slice(0, 3); // Max 3 for Telegram
                                        }
                                    }
                                    
                                    result = JSON.stringify(parsed);
                                } catch (err: any) {
                                    result = `Execution failed: ${err.message}`;
                                }
                            }
                        }

                        return { role: "tool" as const, tool_call_id: tc.id, content: typeof result === 'string' ? result : JSON.stringify(result) };
                    })
                );
                currentMessages.push(...toolResults);
                continue;
            }
            break;
        }

        // Final UX Polish: If the final message is just a JSON specialist envelope, format it.
        if (lastContent.trim().startsWith("{") && lastContent.trim().endsWith("}")) {
            try {
                const parsed = JSON.parse(lastContent);
                if (parsed.specialistSlug && parsed.status && parsed.output) {
                    return formatSpecialistResponse(parsed);
                }
            } catch {
                // Not valid or doesn't match envelope, leave as is
            }
        }

        return lastContent;
    } catch (err) {
        return "I encountered an error while thinking. Please try again later.";
    }
}

async function sendMessage(chatId: number, text: string, token: string) {
    if (!token) {
        console.error("No token provided to sendMessage");
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: "Markdown"
        })
    });
}
