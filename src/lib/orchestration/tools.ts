import { prisma } from "@/lib/db/prisma";
import { openrouter, createChatCompletion } from "@/lib/openrouter/client";
import { getAgentToolsFromConfig, executeOpenAIToolCall } from "@/lib/composio/client";
import { SkillManager } from "@/lib/skills/manager";
import { deductForAgentCall } from "@/lib/credits/engine";
import type OpenAI from "openai";

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

export const ORCHESTRATION_TOOLS: ChatTool[] = [
    {
        type: "function",
        function: {
            name: "delegate_to_specialist",
            description: "Delegates a specific task to a specialist agent.",
            parameters: {
                type: "object",
                properties: {
                    specialistSlug: {
                        type: "string",
                        enum: ["research-assistant", "code-assistant", "productivity-agent"],
                        description: "The slug of the specialist agent to delegate to.",
                    },
                    subQuery: {
                        type: "string",
                        description: "The specific prompt or instruction for the specialist.",
                    },
                },
                required: ["specialistSlug", "subQuery"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "spawn_autonomous_developer",
            description: "Launches an autonomous coding agent (using Composio Agent Orchestrator) to handle a complex repo-level task.",
            parameters: {
                type: "object",
                properties: {
                    project: {
                        type: "string",
                        description: "The name of the project or repo (e.g., 'agent-platform').",
                    },
                    task: {
                        type: "string",
                        description: "A detailed description of the coding task, bug fix, or feature to implement.",
                    },
                    agent: {
                        type: "string",
                        enum: ["claude-code", "aider", "openclaw"],
                        default: "claude-code",
                        description: "The underlying coding agent to use.",
                    },
                },
                required: ["project", "task"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "browse_web",
            description: "Navigates to a URL and returns a text-based snapshot of the page using Vercel's agent-browser. Use this to research websites that don't have APIs or to verify UI rendering.",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The URL to navigate to (e.g., 'https://google.com' or 'http://localhost:3000').",
                    },
                    action: {
                        type: "string",
                        enum: ["snapshot", "screenshot"],
                        default: "snapshot",
                        description: "The action to perform. 'snapshot' returns the accessibility tree with element references (best for LLMs). 'screenshot' returns a base64 encoded image.",
                    },
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_available_skills",
            description: "Lists all available specialized skills from the integrated Anthropic Skills library.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "load_skill_context",
            description: "Loads the detailed instructions and resource inventory for a specific skill. Use this when you identify a skill that matches the user's request.",
            parameters: {
                type: "object",
                properties: {
                    skillId: {
                        type: "string",
                        description: "The ID/folder name of the skill to load (e.g., 'webapp-testing').",
                    },
                },
                required: ["skillId"],
            },
        },
    },
];

export async function executeOrchestrationToolCall(
    userId: string,
    toolName: string,
    args: any,
    sessionId: string
): Promise<string> {
    if (toolName === "delegate_to_specialist") {
        const { specialistSlug, subQuery } = args;

        const agent = await prisma.agentConfig.findUnique({
            where: { slug: specialistSlug },
        });

        if (!agent) {
            return JSON.stringify({ error: `Specialist agent '${specialistSlug}' not found.` });
        }

        // Get tools for the specialist
        let specialistTools: ChatTool[] = [];
        if (agent.tools) {
            try {
                specialistTools = await getAgentToolsFromConfig(agent.tools, userId);
            } catch (err) {
                console.warn(`Failed to fetch tools for specialist ${specialistSlug}`, err);
            }
        }

        // ── CREDIT DEDUCTION ──────────────────────────────────────────────────────
        // Charge for the specialist model call
        const deduction = await deductForAgentCall(
            userId,
            agent.defaultModel,
            `Delegated: ${specialistSlug} - ${subQuery.substring(0, 50)}${subQuery.length > 50 ? "..." : ""}`,
            sessionId
        );

        if (!deduction.success) {
            return JSON.stringify({
                error: `Insufficient credits to call specialist '${specialistSlug}'. Required: ${deduction.cost} $RANDI.`
            });
        }
        // ──────────────────────────────────────────────────────────────────────────

        const messages: ChatMessageParam[] = [
            { role: "system", content: agent.systemPrompt },
            {
                role: "system",
                content: "You are acting on behalf of the Lead Orchestrator for the user's query: '" + subQuery + "'. " +
                    "Use your tools (Gmail, Slack, etc.) to fulfill this request. If you retrieve data, PROVIDE A FULL SUMMARY OF IT. " +
                    "If you get an error, explain what is wrong. Do not simulate results."
            },
            { role: "user", content: subQuery },
        ];

        try {
            // Specialist Tool Loop
            let currentMessages = [...messages];
            let lastContent = "No response from specialist.";

            for (let i = 0; i < 5; i++) {
                const response = await createChatCompletion({
                    model: agent.defaultModel,
                    messages: currentMessages,
                    tools: specialistTools.length > 0 ? specialistTools : undefined,
                });

                const assistantMessage = response.choices?.[0]?.message;
                if (!assistantMessage) break;

                currentMessages.push(assistantMessage as any);
                lastContent = assistantMessage.content || lastContent;

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    const toolResults = await Promise.all(
                        assistantMessage.tool_calls.map(async (tc) => {
                            let result = await executeOpenAIToolCall(userId, tc);
                            if (result.length > 10000) {
                                result = result.substring(0, 10000) + "... [Truncated]";
                            }
                            return { role: "tool" as const, tool_call_id: tc.id, content: result };
                        })
                    );
                    currentMessages.push(...toolResults);
                    continue;
                }

                // No tool calls, we are done
                break;
            }

            return lastContent;
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Orchestration failed";
            return JSON.stringify({ error: msg });
        }
    }

    if (toolName === "spawn_autonomous_developer") {
        const { project, task, agent = "claude-code" } = args;

        try {
            const bridgeUrl = process.env.COMPUTE_BRIDGE_URL;
            const bridgeKey = process.env.COMPUTE_BRIDGE_API_KEY;

            if (!bridgeUrl || !bridgeKey) {
                return JSON.stringify({ error: "Compute bridge is not configured." });
            }

            const response = await fetch(`${bridgeUrl}/spawn-ao`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-bridge-api-key": bridgeKey,
                },
                body: JSON.stringify({ project, task, agent }),
            });

            const result = await response.json();
            if (!response.ok) {
                return JSON.stringify({ error: result.error || "Failed to spawn autonomous developer." });
            }

            return `Successfully spawned an autonomous developer for project '${project}'. 
Task: ${task}
Agent: Aider (using OpenRouter Free Tier)
You can monitor the progress on the dashboard: ${result.dashboardUrl}`;
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to communicate with compute bridge";
            return JSON.stringify({ error: msg });
        }
    }

    if (toolName === "browse_web") {
        const { url, action = "snapshot" } = args;

        try {
            const bridgeUrl = process.env.COMPUTE_BRIDGE_URL;
            const bridgeKey = process.env.COMPUTE_BRIDGE_API_KEY;

            if (!bridgeUrl || !bridgeKey) {
                return JSON.stringify({ error: "Compute bridge is not configured." });
            }

            const response = await fetch(`${bridgeUrl}/browse`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-bridge-api-key": bridgeKey,
                },
                body: JSON.stringify({ url, action }),
            });

            const result = await response.json();
            if (!response.ok) {
                return JSON.stringify({ error: result.error || "Browser action failed." });
            }

            if (action === "snapshot") {
                return `Page snapshot for ${url}:\n\n${result.output}\n\nYou can use these element references (e.g., @e1) in follow-up instructions if needed.`;
            }

            return `Action ${action} completed for ${url}.\nOutput: ${result.output.substring(0, 500)}...`;
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to communicate with compute bridge";
            return JSON.stringify({ error: msg });
        }
    }

    if (toolName === "list_available_skills") {
        try {
            const skills = await SkillManager.listSkills();
            if (skills.length === 0) return "No specialized skills found in library.";

            const list = skills.map(s => `- **${s.id}**: ${s.description}`).join("\n");
            return `Available specialized skills:\n\n${list}\n\nUse 'load_skill_context' with the skill ID to see detailed instructions.`;
        } catch (error) {
            return JSON.stringify({ error: "Failed to list skills" });
        }
    }

    if (toolName === "load_skill_context") {
        const { skillId } = args;
        try {
            const content = await SkillManager.getSkillContent(skillId);
            if (!content) return `Skill '${skillId}' not found.`;

            return `### Skill Context: ${skillId}\n\n${content}`;
        } catch (error) {
            return JSON.stringify({ error: `Failed to load skill '${skillId}'` });
        }
    }

    return JSON.stringify({ error: `Unknown orchestration tool: ${toolName}` });
}

export function isOrchestrationTool(toolName: string): boolean {
    return ORCHESTRATION_TOOLS.some((t) => t.type === "function" && t.function.name === toolName);
}
