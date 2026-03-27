"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Message } from "./ChatWindow";
import { ApprovalCard, type ApprovalDecision } from "./ApprovalCard";
import { WorkflowPlanCard } from "../workflows/WorkflowPlanCard";
import { WorkflowRunCard } from "../workflows/WorkflowRunCard";
import { WorkflowScheduleCard } from "../workflows/WorkflowScheduleCard";
import { ConsolidatedProgressCard, type SpecialistProgressItem, type SpecialistProgressStatus } from "./ConsolidatedProgressCard";

interface MessageBubbleProps {
    message: Message & { parts?: any[] };
    isStreaming?: boolean;
    onApprovalDecision?: (approvalId: string, decision: ApprovalDecision) => void;
    onWorkflowAction?: (workflowId: string, action: string, data?: any) => void;
}

function SpecialistFleetCard({ result }: { result: any }) {
    // If result is a string, try to parse it
    let data = result;
    if (typeof result === 'string') {
        try {
            data = JSON.parse(result);
        } catch {
            return null;
        }
    }

    if (!data || !Array.isArray(data.results)) {
        return null;
    }

    const specialists: SpecialistProgressItem[] = data.results.map((r: any) => ({
        slug: r.specialistSlug,
        role: r.role,
        task: r.delegatedTask,
        status: r.status as SpecialistProgressStatus,
        output: r.output,
    }));

    return (
        <div className="my-3">
            <ConsolidatedProgressCard
                specialists={specialists}
                overallStatus={data.status as SpecialistProgressStatus}
            />
        </div>
    );
}

function ToolInvocationCard({ 
    toolInvocation, 
    onWorkflowAction 
}: { 
    toolInvocation: any;
    onWorkflowAction?: (workflowId: string, action: string, data?: any) => void;
}) {
    const { toolName, toolCallId, state, args, result } = toolInvocation;

    // Special rendering for Specialist Fleet (Parallel Specialists)
    if (toolName === 'conduct_specialists' && state === 'result' && result) {
        return <SpecialistFleetCard result={result} />;
    }

    // Special rendering for Workflow tools
    if (state === 'result' && result) {
        if (toolName === 'compile_workflow_plan' || toolName === 'save_workflow_draft') {
            const plan = toolName === 'compile_workflow_plan' ? result : result.workflow?.plan;
            if (plan) {
                return (
                    <WorkflowPlanCard 
                        plan={plan} 
                        isSaved={toolName === 'save_workflow_draft'}
                        onSave={(p) => onWorkflowAction?.(result.workflow?.id || "new", "save", p)}
                    />
                );
            }
        }

        if (toolName === 'start_workflow_run') {
            const run = result.run;
            if (run) {
                return (
                    <WorkflowRunCard 
                        run={run}
                        onAction={(action) => onWorkflowAction?.(run.workflowId, action, run)}
                    />
                );
            }
        }

        if (toolName === 'configure_workflow_schedule') {
            const schedule = result.schedule;
            if (schedule) {
                return (
                    <WorkflowScheduleCard 
                        schedule={schedule}
                        onAction={(action) => onWorkflowAction?.(schedule.workflowId, action, schedule)}
                    />
                );
            }
        }
    }

    return (
        <div className="my-2 border border-border bg-muted/30 rounded-lg overflow-hidden text-xs">

            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${state === 'result' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="font-mono font-bold">{toolName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono uppercase opacity-70">{toolCallId.slice(-6)}</span>
            </div>

            <div className="p-3 space-y-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Arguments</span>
                    <pre className="p-2 bg-black/20 rounded font-mono text-[10px] overflow-x-auto">
                        {JSON.stringify(args, null, 2)}
                    </pre>
                </div>

                {state === 'result' && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Result</span>
                        <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded font-mono text-[10px] max-h-32 overflow-y-auto">
                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                        </div>
                    </div>
                )}

                {state === 'call' && (
                    <div className="text-[10px] text-amber-400 italic">Executing action...</div>
                )}
            </div>
        </div>
    );
}

/**
 * Code block with language label, line numbers, and copy button.
 */
function CodeBlock({
    language,
    value,
}: {
    language: string;
    value: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard API unavailable
        }
    }, [value]);

    return (
        <div className="relative group/code my-3 rounded-lg overflow-hidden border border-white/10">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#1a1d2e] border-b border-white/10">
                <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
                    {language || "code"}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 transition-colors"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                        </>
                    )}
                </button>
            </div>

            <SyntaxHighlighter
                language={language || "text"}
                style={oneDark}
                showLineNumbers={value.split("\n").length > 3}
                lineNumberStyle={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", minWidth: "2.5em" }}
                customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    padding: "1rem",
                    fontSize: "0.8rem",
                    lineHeight: "1.6",
                    background: "#16181f",
                }}
                wrapLongLines
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
}

/** Markdown component overrides for a polished chat styling */
function useMarkdownComponents(isStreaming: boolean): Components {
    return useMemo<Components>(
        () => ({
            // Code blocks and inline code
            code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const value = String(children).replace(/\n$/, "");
                const isBlock = className?.startsWith("language-") || value.includes("\n");

                if (isBlock) {
                    return <CodeBlock language={match?.[1] || ""} value={value} />;
                }

                return (
                    <code
                        className="px-1.5 py-0.5 rounded text-[0.8em] font-mono bg-white/15 text-rose-200"
                        {...props}
                    >
                        {children}
                    </code>
                );
            },

            // Headings
            h1: ({ children }) => (
                <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>
            ),
            h2: ({ children }) => (
                <h2 className="text-lg font-semibold mt-3 mb-1.5 text-white/90">{children}</h2>
            ),
            h3: ({ children }) => (
                <h3 className="text-base font-semibold mt-2 mb-1 text-white/80">{children}</h3>
            ),

            // Paragraph — keep streaming cursor at end
            p({ children }) {
                return (
                    <p className="mb-2 last:mb-0 leading-relaxed">
                        {children}
                        {isStreaming && <span className="inline-block w-0.5 h-4 ml-0.5 bg-white/70 animate-pulse align-middle" />}
                    </p>
                );
            },

            // Lists
            ul: ({ children }) => (
                <ul className="list-disc list-outside pl-5 mb-2 space-y-0.5">{children}</ul>
            ),
            ol: ({ children }) => (
                <ol className="list-decimal list-outside pl-5 mb-2 space-y-0.5">{children}</ol>
            ),
            li: ({ children }) => (
                <li className="leading-relaxed text-[0.92em]">{children}</li>
            ),

            // Blockquote
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/60 pl-3 my-2 italic text-white/60">
                    {children}
                </blockquote>
            ),

            // Links
            a({ href, children }) {
                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 underline underline-offset-2 hover:text-sky-300 transition-colors"
                    >
                        {children}
                    </a>
                );
            },

            // Tables (GFM)
            table: ({ children }) => (
                <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
                    <table className="w-full text-sm">{children}</table>
                </div>
            ),
            thead: ({ children }) => (
                <thead className="bg-white/5 text-white/70 text-xs uppercase tracking-wider">
                    {children}
                </thead>
            ),
            th: ({ children }) => (
                <th className="px-4 py-2 text-left font-medium">{children}</th>
            ),
            td: ({ children }) => (
                <td className="px-4 py-2 border-t border-white/5">{children}</td>
            ),

            // Horizontal rule
            hr: () => <hr className="my-3 border-white/10" />,

            // Strong / Em
            strong: ({ children }) => (
                <strong className="font-semibold text-white">{children}</strong>
            ),
            em: ({ children }) => (
                <em className="italic text-white/80">{children}</em>
            ),
        }),
        [isStreaming]
    );
}

export function MessageBubble({
    message,
    isStreaming = false,
    onApprovalDecision,
    onWorkflowAction,
}: MessageBubbleProps) {
    if (message.type === "approval_request" && message.approvalRequest) {
        return (
            <div className="flex justify-start w-full">
                <ApprovalCard
                    request={message.approvalRequest}
                    decided={message.approvalDecision}
                    onDecision={(id, decision) => onApprovalDecision?.(id, decision)}
                />
            </div>
        );
    }

    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);
    const markdownComponents = useMarkdownComponents(isStreaming);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const messageDate =
        message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
    const timestamp = !mounted || Number.isNaN(messageDate.getTime())
        ? null
        : messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const fullText = useMemo(() => {
        if (message.content) return message.content;
        if (message.parts) {
            return message.parts
                .filter(p => p.type === 'text')
                .map(p => p.text)
                .join("");
        }
        return "";
    }, [message.content, message.parts]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard API may not be available
        }
    }, [fullText]);

    return (
        <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] lg:max-w-[80%] px-4 py-3 rounded-2xl ${isUser
                    ? `bg-primary text-white rounded-br-md text-sm whitespace-pre-wrap leading-relaxed ${message.error ? "ring-2 ring-red-500/60" : ""
                    }`
                    : "bg-muted/80 text-foreground rounded-bl-md border border-border/60"
                    }`}
            >
                {isUser ? (
                    message.content || (message.parts && message.parts
                        .filter(p => p.type === "text")
                        .map(p => p.text)
                        .join(""))
                ) : (
                    <div className="text-sm leading-relaxed space-y-2">
                        {message.parts && message.parts.length > 0 ? (
                            message.parts.map((part, i) => {
                                if (part.type === 'text') {
                                    return (
                                        <ReactMarkdown
                                            key={i}
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {part.text || ""}
                                        </ReactMarkdown>
                                    );
                                }
                                if (part.type === 'tool-invocation') {
                                    return <ToolInvocationCard key={i} toolInvocation={part.toolInvocation} onWorkflowAction={onWorkflowAction} />;
                                }
                                return null;
                            })

                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {message.content || ""}
                            </ReactMarkdown>
                        )}

                        {/* Improved thinking/streaming indicator */}
                        {isStreaming && !fullText && (!message.parts || message.parts.every(p => p.type !== 'tool-invocation')) && (
                            <div className="flex gap-1 py-1">
                                <span className="w-1 h-1 bg-foreground/70 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1 h-1 bg-foreground/70 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1 h-1 bg-foreground/70 rounded-full animate-bounce"></span>
                            </div>
                        )}
                    </div>
                )}

                <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "justify-end" : "justify-between"}`}>
                    {timestamp && (
                        <span className="text-[10px] opacity-40">{timestamp}</span>
                    )}
                    {!isUser && (
                        <button
                            onClick={handleCopy}
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-[10px] flex items-center gap-1"
                            title="Copy message"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
