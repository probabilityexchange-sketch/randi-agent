import { prisma } from '@/lib/db/prisma';
import { openrouter, createChatCompletion } from '@/lib/openrouter/client';
import {
  getAgentToolsFromConfig,
  executeOpenAIToolCall,
  composioToolsToOpenAI,
} from '@/lib/composio/client';
import { SkillManager } from '@/lib/skills/manager';
import { deductForAgentCall } from '@/lib/credits/engine';
import { evaluateAndRecordPolicy } from '@/lib/policy/service';
import { getBestBridgeNode } from '@/lib/compute/bridge-client';
import { getCallCost } from '@/lib/tokenomics';
import type OpenAI from 'openai';

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

export type SpecialistExpectedOutputFormat =
  | 'summary'
  | 'bullet_list'
  | 'structured_findings'
  | 'action_report'
  | 'status_update';

export type DelegateToSpecialistArgs = {
  specialistSlug:
    | 'research-assistant'
    | 'code-assistant'
    | 'productivity-agent'
    | 'token-launcher'
    | 'seo-assistant'
    | 'audit-assistant';
  taskSummary: string;
  subQuery: string;
  expectedOutput: {
    format: SpecialistExpectedOutputFormat;
    sections?: string[];
  };
  scopeNotes?: string[];
  completionCriteria?: string[];
  maxTurns?: number;
};

export type SpecialistEvidenceItem = {
  kind: 'tool_call' | 'url' | 'note';
  detail: string;
};

export type SpecialistResponseEnvelope = {
  specialistSlug: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  role: string;
  delegatedTask: string;
  completedWork: string[];
  output: string;
  evidence: SpecialistEvidenceItem[];
  blockedBy: string[];
  unresolved: string[];
};

export type ConfidenceWarning = {
  type: 'contradiction' | 'inconsistency' | 'gap';
  specialistA: string;
  specialistB: string;
  findingA: string;
  findingB: string;
  explanation: string;
  severity: 'high' | 'medium' | 'low';
};

export type ShadowAuditResult = {
  verifierSlug: string;
  targetSlug: string;
  contradictionsFound: boolean;
  warnings: ConfidenceWarning[];
  summary: string;
};

const SPECIALIST_ROLE_LABELS: Record<string, string> = {
  'research-assistant': 'research specialist',
  'code-assistant': 'code specialist',
  'productivity-agent': 'productivity specialist',
  'token-launcher': 'token launch specialist',
  'seo-assistant': 'SEO specialist',
  'audit-assistant': 'security audit specialist',
};

/**
 * Formats a specialist response envelope into a human-readable string.
 * This is used to prevent raw JSON from leaking into user-facing surfaces
 * like Telegram when a lead orchestrator returns the raw tool output.
 */
export function formatSpecialistResponse(envelope: SpecialistResponseEnvelope): string {
  const { status, role, delegatedTask, completedWork, output, blockedBy, unresolved } = envelope;

  const emojiMap: Record<string, string> = {
    completed: '✅',
    partial: '🟡',
    blocked: '🛑',
    failed: '❌',
  };

  const statusEmoji = emojiMap[status] || '❓';
  const lines = [
    `${statusEmoji} *${role.toUpperCase()} REPORT*`,
    `*Task:* ${delegatedTask}`,
    '',
    output,
    '',
  ];

  if (completedWork.length > 0) {
    lines.push('*Work Completed:*');
    completedWork.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  }

  if (blockedBy.length > 0) {
    lines.push('*Blocked By:*');
    blockedBy.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  }

  if (unresolved.length > 0 && status !== 'completed') {
    lines.push('*Unresolved Issues:*');
    unresolved.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  }

  return lines.join('\n').trim();
}

function truncateText(value: string, maxLength = 10000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.substring(0, maxLength) + '... [Truncated]';
}

export function buildSpecialistDelegationPrompt(args: DelegateToSpecialistArgs): string {
  const scopeNotes = args.scopeNotes?.length
    ? args.scopeNotes.map(note => `- ${note}`).join('\n')
    : '- Stay within the delegated task only.';
  const completionCriteria = args.completionCriteria?.length
    ? args.completionCriteria.map(item => `- ${item}`).join('\n')
    : '- Stop once the delegated task is complete or blocked.';
  const sections = args.expectedOutput.sections?.length
    ? args.expectedOutput.sections.join(', ')
    : 'completedWork, output, evidence, blockedBy, unresolved';

  return [
    'You are acting as a bounded specialist for the Lead Orchestrator.',
    `Role: ${SPECIALIST_ROLE_LABELS[args.specialistSlug] || args.specialistSlug}`,
    `Delegated task summary: ${args.taskSummary}`,
    '',
    'Delegated request:',
    args.subQuery,
    '',
    'Scope notes:',
    scopeNotes,
    '',
    'Completion criteria:',
    completionCriteria,
    '',
    `Expected output format: ${args.expectedOutput.format}`,
    `Expected sections: ${sections}`,
    '',
    'Return only valid JSON matching this shape:',
    JSON.stringify(
      {
        status: 'completed',
        completedWork: ['Describe concrete work completed'],
        output: 'Final handoff for the lead agent',
        evidence: [{ kind: 'tool_call', detail: 'Tool used or source consulted' }],
        blockedBy: [],
        unresolved: [],
      },
      null,
      2
    ),
    '',
    'Rules:',
    '- Do not simulate tool results or claim work that was not completed.',
    "- If blocked, set status to 'blocked' or 'partial' and explain why.",
    '- Keep evidence limited to tools actually used, URLs actually visited, or concise notes.',
    '- Stop after the delegated task. Do not broaden scope.',
  ].join('\n');
}

export function parseSpecialistResponseEnvelope(
  rawContent: string,
  args: DelegateToSpecialistArgs
): SpecialistResponseEnvelope {
  const fallbackOutput = rawContent?.trim() || 'No response from specialist.';
  const baseEnvelope: SpecialistResponseEnvelope = {
    specialistSlug: args.specialistSlug,
    status: 'failed',
    role: SPECIALIST_ROLE_LABELS[args.specialistSlug] || args.specialistSlug,
    delegatedTask: args.taskSummary,
    completedWork: [],
    output: fallbackOutput,
    evidence: [],
    blockedBy: [],
    unresolved: fallbackOutput
      ? ['Specialist response was unstructured.']
      : ['Specialist returned no content.'],
  };

  try {
    const parsed = JSON.parse(rawContent);
    if (!parsed || typeof parsed !== 'object') {
      return baseEnvelope;
    }

    const status = parsed.status;
    const completedWork = Array.isArray(parsed.completedWork)
      ? parsed.completedWork.filter(
          (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [];
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') return null;
            const kind = (item as { kind?: unknown }).kind;
            const detail = (item as { detail?: unknown }).detail;
            if (
              (kind === 'tool_call' || kind === 'url' || kind === 'note') &&
              typeof detail === 'string' &&
              detail.trim()
            ) {
              return { kind, detail } satisfies SpecialistEvidenceItem;
            }
            return null;
          })
          .filter(
            (item: SpecialistEvidenceItem | null): item is SpecialistEvidenceItem => item !== null
          )
      : [];
    const blockedBy = Array.isArray(parsed.blockedBy)
      ? parsed.blockedBy.filter(
          (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [];
    const unresolved = Array.isArray(parsed.unresolved)
      ? parsed.unresolved.filter(
          (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [];

    return {
      specialistSlug: args.specialistSlug,
      status:
        status === 'completed' ||
        status === 'partial' ||
        status === 'blocked' ||
        status === 'failed'
          ? status
          : 'failed',
      role: SPECIALIST_ROLE_LABELS[args.specialistSlug] || args.specialistSlug,
      delegatedTask: args.taskSummary,
      completedWork,
      output:
        typeof parsed.output === 'string' && parsed.output.trim().length > 0
          ? parsed.output
          : fallbackOutput,
      evidence,
      blockedBy,
      unresolved,
    };
  } catch {
    return baseEnvelope;
  }
}

export const ORCHESTRATION_TOOLS: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'delegate_to_specialist',
      description: 'Delegates a specific task to a specialist agent.',
      parameters: {
        type: 'object',
        properties: {
          specialistSlug: {
            type: 'string',
            enum: [
              'research-assistant',
              'code-assistant',
              'productivity-agent',
              'token-launcher',
              'seo-assistant',
              'audit-assistant',
            ],
            description: 'The slug of the specialist agent to delegate to.',
          },
          taskSummary: {
            type: 'string',
            description: 'A short summary of the bounded objective being delegated.',
          },
          subQuery: {
            type: 'string',
            description: 'The specific prompt or instruction for the specialist.',
          },
          expectedOutput: {
            type: 'object',
            description: 'The handoff shape the specialist must return.',
            properties: {
              format: {
                type: 'string',
                enum: [
                  'summary',
                  'bullet_list',
                  'structured_findings',
                  'action_report',
                  'status_update',
                ],
                description: 'The output format the specialist should target.',
              },
              sections: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional named sections the lead agent expects in the handoff.',
              },
            },
            required: ['format'],
          },
          scopeNotes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional constraints that keep the subtask bounded.',
          },
          completionCriteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional stop conditions for the specialist.',
          },
          maxTurns: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            default: 5,
            description: 'The maximum number of tool-call turns the specialist can take.',
          },
        },
        required: ['specialistSlug', 'taskSummary', 'subQuery', 'expectedOutput'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'conduct_specialists',
      description:
        'Delegates multiple tasks to different specialist agents in parallel. Use this when you need multiple independent tasks completed simultaneously (e.g., SEO audit, Crypto research, and Security audit).',
      parameters: {
        type: 'object',
        properties: {
          delegations: {
            type: 'array',
            description: 'An array of delegation requests to run in parallel.',
            items: {
              type: 'object',
              properties: {
                specialistSlug: {
                  type: 'string',
                  enum: [
                    'research-assistant',
                    'code-assistant',
                    'productivity-agent',
                    'token-launcher',
                    'seo-assistant',
                    'audit-assistant',
                  ],
                  description: 'The slug of the specialist agent to delegate to.',
                },
                taskSummary: {
                  type: 'string',
                  description: 'A short summary of the bounded objective being delegated.',
                },
                subQuery: {
                  type: 'string',
                  description: 'The specific prompt or instruction for the specialist.',
                },
                expectedOutput: {
                  type: 'object',
                  description: 'The handoff shape the specialist must return.',
                  properties: {
                    format: {
                      type: 'string',
                      enum: [
                        'summary',
                        'bullet_list',
                        'structured_findings',
                        'action_report',
                        'status_update',
                      ],
                      description: 'The output format the specialist should target.',
                    },
                    sections: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Optional named sections the lead agent expects in the handoff.',
                    },
                  },
                  required: ['format'],
                },
                scopeNotes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional constraints that keep the subtask bounded.',
                },
                completionCriteria: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional stop conditions for the specialist.',
                },
                maxTurns: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 20,
                  default: 5,
                },
              },
              required: ['specialistSlug', 'taskSummary', 'subQuery', 'expectedOutput'],
            },
          },
        },
        required: ['delegations'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shadow_audit_verify',
      description:
        'Cross-verifies findings between two specialists to detect contradictions, inconsistencies, or gaps. Use after receiving results from multiple specialists to validate logical consistency before presenting the final report to the user.',
      parameters: {
        type: 'object',
        properties: {
          verifierSlug: {
            type: 'string',
            enum: [
              'research-assistant',
              'code-assistant',
              'productivity-agent',
              'token-launcher',
              'seo-assistant',
              'audit-assistant',
            ],
            description:
              'The specialist who will perform the verification (reviews the target findings).',
          },
          targetSlug: {
            type: 'string',
            enum: [
              'research-assistant',
              'code-assistant',
              'productivity-agent',
              'token-launcher',
              'seo-assistant',
              'audit-assistant',
            ],
            description: 'The specialist whose findings will be verified.',
          },
          verifierFindings: {
            type: 'string',
            description: 'The output/findings from the verifier specialist.',
          },
          targetFindings: {
            type: 'string',
            description: 'The output/findings from the target specialist to be checked.',
          },
          focusAreas: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional specific areas to focus the cross-verification on (e.g., security implications, data consistency).',
          },
        },
        required: ['verifierSlug', 'targetSlug', 'verifierFindings', 'targetFindings'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_autonomous_developer',
      description:
        'Launches an autonomous coding agent (using Composio Agent Orchestrator) to handle a complex repo-level task.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: "The name of the project or repo (e.g., 'agent-platform').",
          },
          task: {
            type: 'string',
            description:
              'A detailed description of the coding task, bug fix, or feature to implement.',
          },
          agent: {
            type: 'string',
            enum: ['claude-code', 'aider', 'openclaw'],
            default: 'claude-code',
            description: 'The underlying coding agent to use.',
          },
        },
        required: ['project', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_web',
      description:
        "Navigates to a URL and returns a text-based snapshot of the page using Vercel's agent-browser. Use this to research websites that don't have APIs or to verify UI rendering.",
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              "The URL to navigate to (e.g., 'https://google.com' or 'http://localhost:3000').",
          },
          action: {
            type: 'string',
            enum: ['snapshot', 'screenshot'],
            default: 'snapshot',
            description:
              "The action to perform. 'snapshot' returns the accessibility tree with element references (best for LLMs). 'screenshot' returns a base64 encoded image.",
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_available_skills',
      description:
        'Lists all available specialized skills from the integrated Anthropic Skills library.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'load_skill_context',
      description:
        "Loads the detailed instructions and resource inventory for a specific skill. Use this when you identify a skill that matches the user's request.",
      parameters: {
        type: 'object',
        properties: {
          skillId: {
            type: 'string',
            description: "The ID/folder name of the skill to load (e.g., 'webapp-testing').",
          },
        },
        required: ['skillId'],
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
  if (toolName === 'delegate_to_specialist') {
    const delegation = args as DelegateToSpecialistArgs;
    return runSpecialistDelegation(userId, delegation, sessionId);
  }

  if (toolName === 'conduct_specialists') {
    const { delegations } = args as { delegations: DelegateToSpecialistArgs[] };

    const MAX_PARALLEL_SPECIALISTS = 5;
    if (!Array.isArray(delegations) || delegations.length === 0) {
      return JSON.stringify({ error: 'No delegations provided for conductor.' });
    }
    if (delegations.length > MAX_PARALLEL_SPECIALISTS) {
      return JSON.stringify({
        error: `Too many parallel specialists requested. Maximum is ${MAX_PARALLEL_SPECIALISTS}.`,
      });
    }

    // ── HOLE 2: PRE-FLIGHT CREDIT CHECK ───────────────────────────────────
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenBalance: true },
      });

      if (!user) return JSON.stringify({ error: 'User not found.' });

      const agentConfigs = await prisma.agentConfig.findMany({
        where: { slug: { in: delegations.map(d => d.specialistSlug) } },
      });

      let totalEstimatedCost = 0;
      const slugToModel: Record<string, string> = {};
      agentConfigs.forEach(a => {
        const cost = getCallCost(a.defaultModel).finalCost;
        totalEstimatedCost += cost;
        slugToModel[a.slug] = a.defaultModel;
      });

      if (user.tokenBalance < totalEstimatedCost) {
        return JSON.stringify({
          error: `Insufficient credits for parallel execution. Total required: ${totalEstimatedCost.toLocaleString()} $RANDI. Your balance: ${user.tokenBalance.toLocaleString()} $RANDI.`,
          estimatedCost: totalEstimatedCost,
          balance: user.tokenBalance,
        });
      }
    } catch (err) {
      console.error('Failed pre-flight credit check:', err);
      return JSON.stringify({ error: 'Credit check failed. Please try again.' });
    }
    // ──────────────────────────────────────────────────────────────────────

    const results = await Promise.all(
      delegations.map(d => runSpecialistDelegation(userId, d, sessionId))
    );

    const parseEnvelope = (r: string, fallbackSlug = 'unknown'): SpecialistResponseEnvelope => {
      try {
        return JSON.parse(r) as SpecialistResponseEnvelope;
      } catch {
        return {
          specialistSlug: fallbackSlug,
          status: 'failed',
          role: 'specialist',
          delegatedTask: '',
          completedWork: [],
          output: 'Specialist returned malformed response.',
          evidence: [],
          blockedBy: ['Malformed JSON response'],
          unresolved: ['Delegated task result was unreadable.'],
        };
      }
    };

    let envelopes = results.map((r, i) => parseEnvelope(r, delegations[i].specialistSlug));

    // ── BOUNDED RECOVERY LOOP (max_retries: 1) ───────────────────────────
    const failedIndices = envelopes
      .map((e, i) => (e.status === 'failed' ? i : -1))
      .filter(i => i !== -1);

    if (failedIndices.length > 0) {
      const retryResults = await Promise.all(
        failedIndices.map(i => {
          const original = delegations[i];
          const recovery: DelegateToSpecialistArgs = {
            ...original,
            subQuery: `${original.subQuery}\n\n[Recovery Strategy: Previous attempt failed. Simplify your approach, reduce scope if needed, and try again.]`,
          };
          return runSpecialistDelegation(userId, recovery, sessionId);
        })
      );
      retryResults.forEach((r, idx) => {
        envelopes[failedIndices[idx]] = parseEnvelope(
          r,
          delegations[failedIndices[idx]].specialistSlug
        );
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── HOLE 3: CONTEXT INDIGESTION (TRUNCATE COMBINED) ──────────────────
    const finalStatus = envelopes.every(e => e.status === 'completed') ? 'completed' : 'partial';
    const combinedResponse = {
      status: finalStatus,
      results: envelopes.map(e => ({
        ...e,
        output: truncateText(e.output, 2000), // Truncate sub-agent output for lead context
      })),
    };

    return JSON.stringify(combinedResponse);
  }

  if (toolName === 'spawn_autonomous_developer') {
    const { project, task, agent = 'claude-code' } = args;

    try {
      const bridge = await getBestBridgeNode();
      if (!bridge) {
        return JSON.stringify({ error: 'Compute bridge is not configured or no nodes available.' });
      }

      const bridgeUrl = bridge.getBaseUrl();
      const bridgeKey = process.env.COMPUTE_BRIDGE_API_KEY;
      if (!bridgeKey) {
        return JSON.stringify({ error: 'COMPUTE_BRIDGE_API_KEY is not configured.' });
      }

      const response = await fetch(`${bridgeUrl}/spawn-ao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-api-key': bridgeKey,
        },
        body: JSON.stringify({ project, task, agent }),
      });

      const result = await response.json();
      if (!response.ok) {
        return JSON.stringify({ error: result.error || 'Failed to spawn autonomous developer.' });
      }

      return `Successfully spawned an autonomous developer for project '${project}' on node '${bridge.getNodeId() || 'default'}'.
Task: ${task}
Agent: ${agent}
You can monitor the progress on the dashboard: ${result.dashboardUrl}`;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Failed to communicate with compute bridge';
      return JSON.stringify({ error: msg });
    }
  }

  if (toolName === 'browse_web') {
    const { url, action = 'snapshot' } = args;

    try {
      const bridge = await getBestBridgeNode();
      if (!bridge) {
        return JSON.stringify({ error: 'Compute bridge is not configured or no nodes available.' });
      }

      const bridgeUrl = bridge.getBaseUrl();
      const bridgeKey = process.env.COMPUTE_BRIDGE_API_KEY;

      const response = await fetch(`${bridgeUrl}/browse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-api-key': bridgeKey!,
        },
        body: JSON.stringify({ url, action }),
      });

      const result = await response.json();
      if (!response.ok) {
        return JSON.stringify({ error: result.error || 'Browser action failed.' });
      }

      if (action === 'snapshot') {
        return `Page snapshot for ${url} (via ${bridge.getNodeId() || 'default'}):\n\n${result.output}\n\nYou can use these element references (e.g., @e1) in follow-up instructions if needed.`;
      }

      return `Action ${action} completed for ${url} on ${bridge.getNodeId() || 'default'}.\nOutput: ${result.output.substring(0, 500)}...`;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Failed to communicate with compute bridge';
      return JSON.stringify({ error: msg });
    }
  }

  if (toolName === 'list_available_skills') {
    try {
      const skills = await SkillManager.listSkills();
      if (skills.length === 0) return 'No specialized skills found in library.';

      const list = skills.map(s => `- **${s.id}**: ${s.description}`).join('\n');
      return `Available specialized skills:\n\n${list}\n\nUse 'load_skill_context' with the skill ID to see detailed instructions.`;
    } catch (error) {
      return JSON.stringify({ error: 'Failed to list skills' });
    }
  }

  if (toolName === 'load_skill_context') {
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

async function runSpecialistDelegation(
  userId: string,
  delegation: DelegateToSpecialistArgs,
  sessionId: string
): Promise<string> {
  const { specialistSlug, subQuery, taskSummary } = delegation;

  const agent = await prisma.agentConfig.findUnique({
    where: { slug: specialistSlug },
  });

  if (!agent) {
    return JSON.stringify({
      specialistSlug,
      status: 'failed',
      role: SPECIALIST_ROLE_LABELS[specialistSlug] || specialistSlug,
      delegatedTask: taskSummary,
      completedWork: [],
      output: `Specialist agent '${specialistSlug}' not found.`,
      evidence: [],
      blockedBy: [`Specialist agent '${specialistSlug}' not found.`],
      unresolved: ['Delegated task did not start.'],
    } satisfies SpecialistResponseEnvelope);
  }

  // Get tools for the specialist
  let specialistTools: ChatTool[] = [];
  if (agent.tools) {
    try {
      const composioTools = await getAgentToolsFromConfig(agent.tools, userId, specialistSlug);
      specialistTools = composioToolsToOpenAI(composioTools);
    } catch (err) {
      console.warn(`Failed to fetch tools for specialist ${specialistSlug}`, err);
    }
  }

  // ── CREDIT DEDUCTION ──────────────────────────────────────────────────────
  const deduction = await deductForAgentCall(
    userId,
    agent.defaultModel,
    `Delegated: ${specialistSlug} - ${taskSummary.substring(0, 50)}${taskSummary.length > 50 ? '...' : ''}`,
    sessionId
  );

  if (!deduction.success) {
    return JSON.stringify({
      specialistSlug,
      status: 'failed',
      role: SPECIALIST_ROLE_LABELS[specialistSlug] || specialistSlug,
      delegatedTask: taskSummary,
      completedWork: [],
      output: `Insufficient credits to call specialist '${specialistSlug}'. Required: ${deduction.cost} $RANDI.`,
      evidence: [],
      blockedBy: ['Insufficient credits'],
      unresolved: ['Delegated task aborted due to lack of credits.'],
    } satisfies SpecialistResponseEnvelope);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const messages: ChatMessageParam[] = [
    { role: 'system', content: agent.systemPrompt },
    {
      role: 'system',
      content: buildSpecialistDelegationPrompt(delegation),
    },
    { role: 'user', content: subQuery },
  ];

  try {
    // Specialist Tool Loop
    let currentMessages = [...messages];
    let lastContent = 'No response from specialist.';
    const loopLimit = delegation.maxTurns || 5;

    for (let i = 0; i < loopLimit; i++) {
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
          assistantMessage.tool_calls.map(async tc => {
            if (tc.type !== 'function' || !tc.function) {
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: 'Unsupported tool type.',
              };
            }

            const toolName = tc.function.name;
            const toolArgs = JSON.parse(tc.function.arguments || '{}');

            // --- POLICY GATE: Specialists must also respect policies ---
            const policyDecision = await evaluateAndRecordPolicy({
              subjectType: 'tool_call',
              actor: { userId, sessionId: sessionId ?? undefined },
              triggerSource: 'orchestration',
              toolName,
              toolArgs,
              scopes: [
                {
                  tool: toolName,
                  mode: 'write',
                  resources: [],
                  reason: `Specialist ${specialistSlug} requested tool ${toolName}`,
                },
              ],
            });

            if (policyDecision.decision === 'deny') {
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: JSON.stringify({ error: `Policy Denied: ${policyDecision.reason}` }),
              };
            }

            if (policyDecision.decision === 'approve') {
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: JSON.stringify({
                  error:
                    'Specialist attempted a tool call that requires manual approval. Delegation aborted.',
                }),
              };
            }
            // ---------------------------------------------------------

            let result = await executeOpenAIToolCall(userId, tc, undefined, specialistSlug);
            result = truncateText(result);
            return { role: 'tool' as const, tool_call_id: tc.id, content: result };
          })
        );
        currentMessages.push(...toolResults);
        continue;
      }

      // No tool calls, we are done
      break;
    }

    return JSON.stringify(parseSpecialistResponseEnvelope(lastContent, delegation));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Orchestration failed';
    return JSON.stringify({
      specialistSlug,
      status: 'failed',
      role: SPECIALIST_ROLE_LABELS[specialistSlug] || specialistSlug,
      delegatedTask: taskSummary,
      completedWork: [],
      output: `Specialist execution failed: ${msg}`,
      evidence: [],
      blockedBy: [msg],
      unresolved: ['Delegated task did not complete.'],
    } satisfies SpecialistResponseEnvelope);
  }
}

export function isOrchestrationTool(toolName: string): boolean {
  return ORCHESTRATION_TOOLS.some(t => t.type === 'function' && t.function.name === toolName);
}
