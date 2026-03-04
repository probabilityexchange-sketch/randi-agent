"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ChatWindow, type Message } from "@/components/chat/ChatWindow";
import { RuntimeBadge } from "@/components/chat/RuntimeBadge";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { CustomizeAgentDrawer } from "@/components/chat/CustomizeAgentDrawer";

export default function ChatSessionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const sessionIdFromParams = params.sessionId === "new" ? undefined : (params.sessionId as string);
    const agentIdFromUrl = searchParams.get("agentId");

    const [loading, setLoading] = useState(sessionIdFromParams ? true : false);
    const [initialMessages, setInitialMessages] = useState<Message[]>([]);
    const [agentName, setAgentName] = useState("Agent");
    const [currentAgentId, setCurrentAgentId] = useState<string | null>(agentIdFromUrl);
    const [sessionId, setSessionId] = useState<string | undefined>(sessionIdFromParams);
    const [selectedModel, setSelectedModel] = useState("meta-llama/llama-3.3-70b-instruct:free");
    const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

    // Persist model selection
    useEffect(() => {
        const savedModel = localStorage.getItem("randi_selected_model");
        if (savedModel) {
            setSelectedModel(savedModel);
        }
    }, []);

    useEffect(() => {
        if (selectedModel) {
            localStorage.setItem("randi_selected_model", selectedModel);
        }
    }, [selectedModel]);

    useEffect(() => {
        if (sessionId) {
            // Fetch session messages
            fetch(`/api/chat/sessions/${sessionId}`)
                .then((res) => res.json())
                .then((data) => {
                    const messages = Array.isArray(data?.messages)
                        ? data.messages.map((message: {
                            id?: string;
                            role?: "user" | "assistant" | "system";
                            content?: string;
                            createdAt?: string | Date;
                        }) => ({
                            id: message.id || crypto.randomUUID(),
                            role: message.role || "assistant",
                            content: typeof message.content === "string" ? message.content : "",
                            createdAt:
                                message.createdAt instanceof Date
                                    ? message.createdAt
                                    : new Date(message.createdAt || Date.now()),
                        }))
                        : [];

                    setInitialMessages(messages);
                    setAgentName(typeof data?.agent?.name === "string" ? data.agent.name : "Agent");
                    if (data?.agent?.id) setCurrentAgentId(data.agent.id);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Error fetching session:", err);
                    setLoading(false);
                });
        } else if (agentIdFromUrl) {
            // Fetch agent name for the header
            fetch(`/api/agents`)
                .then((res) => res.json())
                .then((data) => {
                    const agent = (data.agents as any[]).find(a => a.id === agentIdFromUrl || a.slug === agentIdFromUrl);
                    if (agent) setAgentName(agent.name);
                })
                .catch((err) => console.error("Error fetching agent:", err));
        }
    }, [sessionId, agentIdFromUrl]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!agentIdFromUrl && !sessionId) {
        return (
            <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                    <h2 className="text-2xl font-bold mb-4">No Agent Selected</h2>
                    <button
                        onClick={() => router.push("/chat")}
                        className="bg-primary text-white px-6 py-2 rounded-lg"
                    >
                        Go to Chat Hub
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/chat")}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="font-bold text-xl">{agentName}</h2>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Active Chat</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCustomizeOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <span>Customize</span>
                    </button>
                    <ModelSelector
                        selectedModel={selectedModel}
                        onChange={setSelectedModel}
                    />
                    {currentAgentId && (
                        <RuntimeBadge agentId={currentAgentId} sessionId={sessionId} />
                    )}
                </div>
            </div>


            <div className="flex-1 min-h-0">
                <ChatWindow
                    key={sessionId || `new-${currentAgentId || "agent"}`}
                    agentId={currentAgentId || ""}
                    sessionId={sessionId}
                    model={selectedModel}
                    initialMessages={initialMessages}
                    onSessionCreated={(newSessionId) => {
                        setSessionId(newSessionId);
                        if (!sessionId) {
                            if (typeof window !== "undefined") {
                                const suffix = currentAgentId
                                    ? `?agentId=${encodeURIComponent(currentAgentId)}`
                                    : "";
                                window.history.replaceState(
                                    window.history.state,
                                    "",
                                    `/chat/${newSessionId}${suffix}`
                                );
                            }
                        }
                    }}
                />
            </div>

            {currentAgentId && (
                <CustomizeAgentDrawer
                    agentId={currentAgentId}
                    isOpen={isCustomizeOpen}
                    onClose={() => setIsCustomizeOpen(false)}
                />
            )}
        </div>
    );
}
