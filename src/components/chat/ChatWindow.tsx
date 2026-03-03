"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ApprovalDecision } from "./ApprovalCard";

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
}

interface ChatWindowProps {
    agentId: string;
    sessionId?: string;
    model: string;
    initialMessages?: Message[];
    onSessionCreated?: (sessionId: string) => void;
}

export function ChatWindow({
    agentId,
    sessionId,
    model,
    initialMessages = [],
    onSessionCreated,
}: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial message normalization to match SDK's expectation if needed
    // However, useChat usually expects UIMessages.
    const normalizedInitialMessages = useMemo(() => {
        return initialMessages.map(m => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt),
        }));
    }, [initialMessages]);

    const {
        messages,
        input,
        setInput,
        append,
        isLoading,
        error: chatError,
        reload,
    } = useChat({
        api: "/api/chat",
        body: {
            agentId,
            sessionId,
            model,
        },
        initialMessages: normalizedInitialMessages as any,
        onResponse: (response) => {
            // Check if this was an approval request (202 status)
            if (response.status === 202) {
                // We'll handle this in the setMessages/onFinish logic if needed
                // But for now, the SDK might not handle 202 JSON response well during a stream.
            }
        },
        onFinish: (message) => {
            // If the backend created a new session, it would typically be in a header
            // but for Randi we might rely on the sessionId prop updating from the parent.
        }
    });

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;
        await append({
            role: "user",
            content,
        });
    }, [append]);

    const handleApprovalDecision = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
        // Find the user message associated with this flow to resume it
        const lastUserMessage = [...messages].reverse().find(m => m.role === "user");

        // Optimistically update the UI to show decision
        // In a real app, we'd probably want the SDK to handle this, but for HITL resume:
        if (decision === "APPROVED" || decision === "REJECTED") {
            // Resume by sending a special signal or just the approvalId
            await append({
                role: "user",
                content: lastUserMessage?.content || "Resume",
            }, {
                data: { resumeApprovalId: approvalId, decision } as any
            });
        }
    }, [messages, append]);

    return (
        <div className="flex flex-col h-full bg-card/30 rounded-xl border border-border overflow-hidden">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
                        <p className="text-muted-foreground max-w-xs">
                            Send a message to begin interacting with the agent.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={{
                            ...msg,
                            createdAt: msg.createdAt || new Date(),
                        } as any}
                        isStreaming={isLoading && msg.id === messages[messages.length - 1].id && msg.role === "assistant"}
                        onApprovalDecision={handleApprovalDecision}
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
                {chatError && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <p className="text-sm text-rose-400">{chatError.message || "An error occurred"}</p>
                        <button
                            onClick={() => reload()}
                            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-2 py-1 rounded transition-colors whitespace-nowrap"
                        >
                            Retry
                        </button>
                    </div>
                )}
                <ChatInput
                    onSend={handleSendMessage}
                    disabled={isLoading}
                />
            </div>
        </div>
    );
}
