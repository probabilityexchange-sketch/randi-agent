import { createDataStreamResponse, type ToolSet, type ModelMessage } from "ai";
import { createChatCompletion } from "@/lib/openrouter/client";
import { prisma } from "@/lib/db/prisma";

export async function handleNonStandardChat({
    auth,
    model,
    agent,
    message,
    history,
    tools,
    sessionId,
}: {
    auth: { userId: string };
    model: string;
    agent: { id: string; systemPrompt: string };
    message: string;
    history: ModelMessage[];
    tools: ToolSet;
    sessionId?: string;
}) {
    return createDataStreamResponse({
        execute: async (dataStream) => {
            let currentHistory: any[] = [
                ...history,
                { role: "user", content: message },
            ];

            let lastText = "";
            let iterations = 0;
            const MAX_RESILIENCE_STEPS = 10;

            dataStream.writeMessageAnnotation({ type: "status", content: "Initializing resilience loop..." });

            while (iterations < MAX_RESILIENCE_STEPS) {
                iterations++;
                dataStream.writeMessageAnnotation({ type: "status", content: `Step ${iterations}: Thinking...` });

                const response = await createChatCompletion({
                    model,
                    messages: [
                        { role: "system", content: agent.systemPrompt },
                        ...currentHistory,
                    ],
                    // Pass tools in OpenAI format
                    tools: Object.entries(tools).map(([name, t]: [string, any]) => ({
                        type: "function",
                        function: {
                            name,
                            description: t.description,
                            parameters: t.parameters || t.inputSchema,
                        },
                    })) as any,
                });

                const assistantMsg = response.choices[0].message;
                currentHistory.push(assistantMsg);

                if (assistantMsg.content) {
                    lastText = assistantMsg.content;
                    dataStream.writeText(assistantMsg.content);
                }

                if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
                    dataStream.writeMessageAnnotation({ type: "status", content: `Step ${iterations}: Executing ${assistantMsg.tool_calls.length} tools...` });

                    const toolResults = await Promise.all(
                        assistantMsg.tool_calls.map(async (tc: any) => {
                            const toolName = tc.function.name;
                            const toolArgs = JSON.parse(tc.function.arguments);
                            const toolImpl = tools[toolName] as any;

                            if (!toolImpl) {
                                return {
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    content: JSON.stringify({ error: `Tool ${toolName} not found` }),
                                };
                            }

                            try {
                                const result = await toolImpl.execute(toolArgs, { toolCallId: tc.id });
                                return {
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    content: typeof result === "string" ? result : JSON.stringify(result),
                                };
                            } catch (err: any) {
                                return {
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    content: JSON.stringify({ error: err.message || "Execution failed" }),
                                };
                            }
                        })
                    );

                    currentHistory.push(...toolResults);
                    // Loop continues to next iteration for the model to process tool results
                } else {
                    // No more tools, we're done
                    break;
                }
            }

            // Final persistence
            let currentSessionId = sessionId;
            if (!currentSessionId) {
                const newSession = await prisma.chatSession.create({
                    data: {
                        userId: auth.userId,
                        agentId: agent.id,
                        title: message.substring(0, 50),
                    },
                });
                currentSessionId = newSession.id;
            }

            await prisma.chatMessage.createMany({
                data: [
                    { sessionId: currentSessionId, role: "user", content: message },
                    {
                        sessionId: currentSessionId,
                        role: "assistant",
                        content: lastText,
                        toolCalls: currentHistory
                            .filter((m) => m.role === "assistant" && m.tool_calls)
                            .map((m) => JSON.stringify(m.tool_calls))
                            .join("\n"),
                    },
                ],
            });
        },
    });
}
