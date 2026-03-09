"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    initialValue?: string;
}

export function ChatInput({ onSend, disabled, initialValue = "" }: ChatInputProps) {
    const [input, setInput] = useState(initialValue);
    const [isListening, setIsListening] = useState(false);
    const [supportsVoice, setSupportsVoice] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);
    const helperId = useId();

    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                setSupportsVoice(true);

                recognitionRef.current.onresult = (event: any) => {
                    let finalTranscript = "";

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript) {
                        setInput(prev => {
                            const current = prev.trim();
                            return current ? `${current} ${finalTranscript}` : finalTranscript;
                        });
                    }

                    if (textareaRef.current) {
                        textareaRef.current.style.height = "auto";
                        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech recognition error:", event.error);
                    setIsListening(false);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                    textareaRef.current?.focus();
                };
            }
        }
    }, []);

    useEffect(() => {
        if (!initialValue) return;

        setInput((current) => current.trim().length > 0 ? current : initialValue);

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
        });
    }, [initialValue]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input);
            setInput("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        // Auto-resize
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="space-y-2">
            <div className={`flex items-end gap-2 bg-background/50 border rounded-xl p-2 transition-all ${isListening ? 'border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] ring-1 ring-primary/50' : 'border-border focus-within:ring-2 focus-within:ring-primary/20'
                }`}>
                {supportsVoice && (
                    <button
                        type="button"
                        onClick={toggleListening}
                        disabled={disabled}
                        aria-label={isListening ? "Stop voice input" : "Start voice input"}
                        aria-pressed={isListening}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isListening
                                ? "text-primary bg-primary/10 animate-pulse"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground bg-transparent"
                            }`}
                        title={isListening ? "Stop voice input" : "Start voice input"}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span className="hidden sm:inline">{isListening ? "Listening" : "Voice"}</span>
                    </button>
                )}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Listening. Speak your task or context…" : "Describe one task. Example: draft a reply, summarize this link, or plan the next step."}
                    rows={1}
                    disabled={disabled}
                    aria-label="Message Randi with a task or question"
                    aria-describedby={helperId}
                    className={`flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-3 text-sm max-h-32 scrollbar-thin overflow-y-auto ${isListening ? "text-primary/80" : ""
                        }`}
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || disabled}
                    aria-label="Send message"
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${!input.trim() || disabled
                        ? "text-muted-foreground bg-transparent"
                        : "text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                        }`}
                >
                    <span>Send</span>
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                    </svg>
                </button>
            </div>
            <p id={helperId} className="px-1 text-sm text-muted-foreground">
                Press Enter to send. Use Shift+Enter for a new line. Randi will pause in chat if a connected tool needs approval.
            </p>
        </div>
    );
}
