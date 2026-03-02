"use client";

import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useMemo } from "react";

export default function TestChatV2() {
    const [model, setModel] = useState("meta-llama/llama-3.3-70b-instruct:free");
    const [inputValue, setInputValue] = useState("");

    // Build a Chat instance with the transport pointing to our v2 route
    const chat = useMemo(() => new Chat({
        transport: new DefaultChatTransport({
            api: "/api/chat/v2",
            body: {
                model,
                agentSlug: "randi-lead",
            },
        }),
    }), [model]);

    const { messages, sendMessage, status } = useChat({ chat });

    const isLoading = status === "streaming" || status === "submitted";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        // In SDK v6, sendMessage takes message parts
        sendMessage({
            role: "user",
            parts: [{ type: "text", text: inputValue }],
        });
        setInputValue("");
    };

    // Helper to extract text from parts
    const getMessageText = (m: (typeof messages)[number]) => {
        return m.parts
            .filter(p => p.type === "text")
            .map(p => (p as { type: "text"; text: string }).text)
            .join("");
    };

    return (
        <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch font-mono">
            <h1 className="text-xl font-bold mb-4">Chat V2 (Vercel AI SDK)</h1>

            <div className="mb-4">
                <label className="block text-xs mb-1">Model</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded text-sm bg-black text-white"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                />
            </div>

            <div className="space-y-4 mb-4">
                {messages.map(m => (
                    <div key={m.id} className="whitespace-pre-wrap">
                        <span className="font-bold">{m.role === 'user' ? 'User: ' : 'AI: '}</span>
                        {getMessageText(m)}
                    </div>
                ))}
                {isLoading && <div className="text-gray-400 italic">Thinking...</div>}
            </div>

            <form onSubmit={handleSubmit}>
                <input
                    className="fixed bottom-0 w-full max-w-md p-4 mb-8 border border-gray-300 rounded shadow-xl bg-black text-white"
                    value={inputValue}
                    placeholder="Say something..."
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isLoading}
                />
            </form>
        </div>
    );
}
