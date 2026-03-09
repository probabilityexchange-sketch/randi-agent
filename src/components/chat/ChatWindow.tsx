"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ApprovalDecision } from "./ApprovalCard";

const STARTER_PROMPTS = [
    "Summarize this link and tell me what matters.",
    "Draft a reply from these notes.",
    "Turn this into a checklist with next steps.",
    "Help me plan this task before taking action.",
];

export interface Message {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    createdAt: Date | string;
    error?: boolean;
    type?: "text" | "approval_request";
    toolCalls?: any; // For tool calls
    toolResults?: any;
    approvalRequest?: any;
    approvalDecision?: ApprovalDecision;
    parts?: any[];
}

interface ChatWindowProps {
    agentId: string;
    sessionId?: string;
    model: string;
    initialMessages?: Message[];
    initialDraft?: string;
}

export function ChatWindow({
    agentId,
    sessionId,
    model,
    initialMessages = [],
    initialDraft = "",
}: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    // Transform initial messages to SDK v6 format
    const transformedInitialMessages = useMemo(() => {
        return initialMessages.map(m => ({
            id: m.id,
            role: (m.role === "tool" ? "assistant" : m.role) as "user" | "assistant" | "system",
            parts: m.parts || [{ type: "text", text: m.content }],
            metadata: { createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt) }
        }));
    }, [initialMessages]);

    // Build the transport and chat object
    const chat = useMemo(() => new Chat({
        messages: transformedInitialMessages as any,
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: {
                agentId,
                sessionId,
                model,
            },
        }),
    }), [agentId, sessionId, model, transformedInitialMessages]);

    const {
        messages,
        sendMessage,
        status,
        regenerate,
        error: chatError,
    } = useChat({
        chat,
    });

    const isLoading = status === "streaming" || status === "submitted";

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;
        setLocalError(null);

        try {
            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: content }],
            });
        } catch (err) {
            console.error("SendMessage error:", err);
            setLocalError(err instanceof Error ? err.message : "Failed to send message");
        }
    }, [sendMessage, isLoading]);

    const handleApprovalDecision = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
        if (decision === "APPROVED" || decision === "REJECTED") {
            try {
                // In v6, additional data is passed in the body option of ChatRequestOptions
                await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: "(Resume)" }],
                }, {
                    body: { resumeApprovalId: approvalId, decision }
                });
            } catch (err) {
                console.error("Approval flow error:", err);
            }
        }
    }, [sendMessage]);

    const handleWorkflowAction = useCallback(async (workflowId: string, action: string, data?: any) => {
        if (action === "save") {
            try {
                await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: `Save this workflow: ${data.title}` }],
                }, {
                    // We can pass data to the backend if needed, but the agent 
                    // should be able to handle it if we just say "save this"
                    body: { workflowAction: action, workflowId, workflowData: data }
                });
            } catch (err) {
                console.error("Workflow save error:", err);
            }
        } else if (action === "view_approval") {
            // Logic to find and show the approval request
            // For now, we just tell the agent to show it
            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: "Show the pending approval for this run." }],
            });
        }
    }, [sendMessage]);

    return (
        <div className="flex flex-col h-full min-h-[24rem] bg-card/30 rounded-xl border border-border overflow-hidden">
            <div
                ref={scrollRef}
                role="log"
                aria-label="Chat conversation"
                aria-live="polite"
                aria-busy={isLoading}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Start here</p>
                        <h3 className="mt-2 text-2xl font-semibold">Bring one concrete task</h3>
                        <p className="mt-2 text-muted-foreground max-w-xl leading-relaxed">
                            Ask Randi to research, summarize, draft, plan, or help you take an action. Paste notes or a link if you have them. If a connected tool is needed, you can review the request before anything sensitive runs.
                        </p>
                        <div className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                            {STARTER_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => void handleSendMessage(prompt)}
                                    disabled={isLoading}
                                    className="rounded-2xl border border-border bg-card/50 px-4 py-4 text-left text-sm font-medium text-foreground/90 transition-all hover:border-primary/40 hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                        <div className="mt-6 max-w-xl rounded-2xl border border-border/60 bg-background/40 p-4 text-left">
                            <p className="text-sm font-semibold text-foreground">How approvals work</p>
                            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                Randi only pauses when a tool request needs review. You will see the app, requested action, likely effect, and technical details before choosing whether to continue.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={{
                            ...msg,
                            createdAt: (msg as any).metadata?.createdAt || new Date(),
                        } as any}
                        isStreaming={status === "streaming" && msg.id === messages[messages.length - 1].id && msg.role === "assistant"}
                        onApprovalDecision={handleApprovalDecision}
                        onWorkflowAction={handleWorkflowAction}
                    />
                ))}


                {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                        <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-none">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border bg-card/50">
                {(chatError || localError) && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <p className="text-sm text-rose-400">{(chatError as any)?.message || localError || "An error occurred"}</p>
                        <button
                            onClick={() => regenerate()}
                            className="text-sm bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                        >
                            Try again
                        </button>
                    </div>
                )}
                <div className="mb-3 grid gap-3 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 sm:grid-cols-2">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Best results start with context</p>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Say what you want back, paste the source material, and mention any constraints or tone you care about.
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">Approvals stay in chat</p>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Planning and drafting can happen immediately. Sensitive tool actions pause here so you can approve or decline them.
                        </p>
                    </div>
                </div>
                <ChatInput
                    onSend={handleSendMessage}
                    disabled={isLoading}
                    initialValue={initialDraft}
                />
            </div>
        </div>
    );
}
