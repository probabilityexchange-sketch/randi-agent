import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createChatCompletion } from "@/lib/openrouter/client";
import { executeOrchestrationToolCall, ORCHESTRATION_TOOLS } from "@/lib/orchestration/tools";
import { getAgentToolsFromConfig } from "@/lib/composio/client";

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

        const body = await req.json();
        const message = body.message;
        if (!message || !message.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const text = message.text;
        const telegramUserId = message.from.id.toString();

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
    let tools = [];
    if (agent.tools) {
        try {
            tools = await getAgentToolsFromConfig(agent.tools, userId);
        } catch (err) {
            console.warn("[Telegram] Failed to fetch tools", err);
        }
    }

    // Always include orchestration tools for delegation
    const combinedTools = [...tools, ...ORCHESTRATION_TOOLS];

    const messages = [
        { role: "system", content: agent.systemPrompt },
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

            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                const toolResults = await Promise.all(
                    assistantMessage.tool_calls.map(async (tc) => {
                        let result;
                        if (ORCHESTRATION_TOOLS.some(t => t.function.name === tc.function.name)) {
                            result = await executeOrchestrationToolCall(userId, tc.function.name, JSON.parse(tc.function.arguments), "telegram-session");
                        } else {
                            // Native tools (Gmail, etc.)
                            // In a real app, we'd need to handle runtimeUrls if using dedicated containers
                            // For Telegram, we'll assume shared/fallback for now
                            result = "Tool execution via Telegram is currently limited to orchestration.";
                        }
                        return { role: "tool" as const, tool_call_id: tc.id, content: result };
                    })
                );
                currentMessages.push(...toolResults);
                continue;
            }
            break;
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
