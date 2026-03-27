import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/openrouter/client', () => ({
  openrouter: {},
  createChatCompletion: vi.fn(),
}));

vi.mock('@/lib/composio/client', () => ({
  getAgentToolsFromConfig: vi.fn().mockResolvedValue([]),
  executeOpenAIToolCall: vi.fn().mockResolvedValue('tool result'),
  composioToolsToOpenAI: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/credits/engine', () => ({
  deductForAgentCall: vi.fn(),
}));

vi.mock('@/lib/policy/service', () => ({
  evaluateAndRecordPolicy: vi.fn(),
}));

vi.mock('@/lib/compute/bridge-client', () => ({
  getBestBridgeNode: vi.fn(),
}));

vi.mock('@/lib/tokenomics', () => ({
  getCallCost: vi.fn().mockReturnValue({ finalCost: 100 }),
}));

vi.mock('@/lib/skills/manager', () => ({
  SkillManager: {
    listSkills: vi.fn().mockResolvedValue([]),
    getSkillContent: vi.fn().mockResolvedValue(null),
  },
}));

import {
  buildSpecialistDelegationPrompt,
  parseSpecialistResponseEnvelope,
  formatSpecialistResponse,
  executeOrchestrationToolCall,
  type DelegateToSpecialistArgs,
  type SpecialistResponseEnvelope,
} from '@/lib/orchestration/tools';
import { prisma } from '@/lib/db/prisma';
import { createChatCompletion } from '@/lib/openrouter/client';
import { deductForAgentCall } from '@/lib/credits/engine';
import { evaluateAndRecordPolicy } from '@/lib/policy/service';
import { executeOpenAIToolCall } from '@/lib/composio/client';
import { getCallCost } from '@/lib/tokenomics';
import { getBestBridgeNode } from '@/lib/compute/bridge-client';

// ── Shared fixture ────────────────────────────────────────────────────────────

const baseArgs: DelegateToSpecialistArgs = {
  specialistSlug: 'research-assistant',
  taskSummary: 'Check two market data sources for BTC headline moves',
  subQuery: 'Inspect the latest BTC headlines and summarize catalysts from two sources.',
  expectedOutput: {
    format: 'structured_findings',
    sections: ['completedWork', 'output', 'evidence', 'blockedBy', 'unresolved'],
  },
  scopeNotes: ['Use only the assigned research tools.', 'Do not give trading advice.'],
  completionCriteria: ['Stop after two sources are checked.', 'Report if a source is unavailable.'],
};

const mockAgent = {
  slug: 'research-assistant',
  systemPrompt: 'You are a research specialist.',
  defaultModel: 'openai/gpt-4o-mini',
  tools: null,
};

// ── Pure function tests ───────────────────────────────────────────────────────

it('buildSpecialistDelegationPrompt includes bounded contract details', () => {
  const prompt = buildSpecialistDelegationPrompt(baseArgs);

  expect(prompt).toMatch(/Delegated task summary: Check two market data sources/);
  expect(prompt).toMatch(/Expected output format: structured_findings/);
  expect(prompt).toMatch(/Scope notes:/);
  expect(prompt).toMatch(/Completion criteria:/);
  expect(prompt).toMatch(/Return only valid JSON matching this shape:/);
  expect(prompt).toMatch(/Do not simulate tool results/);
});

it('parseSpecialistResponseEnvelope preserves structured completion details', () => {
  const envelope = parseSpecialistResponseEnvelope(
    JSON.stringify({
      status: 'partial',
      completedWork: ['Checked CoinMarketCap headlines', 'Reviewed one browser snapshot'],
      output: 'BTC moved after ETF flow commentary, but the second source timed out.',
      evidence: [
        { kind: 'tool_call', detail: 'COINMARKETCAP_GET_CRYPTO_NEWS' },
        { kind: 'url', detail: 'https://example.com/btc-news' },
      ],
      blockedBy: ['Second source returned a timeout'],
      unresolved: ['Need confirmation from another independent source'],
    }),
    baseArgs
  );

  expect(envelope.specialistSlug).toBe('research-assistant');
  expect(envelope.status).toBe('partial');
  expect(envelope.completedWork).toEqual([
    'Checked CoinMarketCap headlines',
    'Reviewed one browser snapshot',
  ]);
  expect(envelope.evidence.length).toBe(2);
  expect(envelope.blockedBy).toEqual(['Second source returned a timeout']);
  expect(envelope.unresolved).toEqual(['Need confirmation from another independent source']);
});

it('parseSpecialistResponseEnvelope marks unstructured text as unresolved raw handoff', () => {
  const envelope = parseSpecialistResponseEnvelope(
    'Looked around and found some things.',
    baseArgs
  );

  expect(envelope.status).toBe('failed');
  expect(envelope.output).toBe('Looked around and found some things.');
  expect(envelope.completedWork).toEqual([]);
  expect(envelope.unresolved[0]).toMatch(/unstructured/i);
});

it('formatSpecialistResponse returns human readable markdown', () => {
  const envelope: SpecialistResponseEnvelope = {
    specialistSlug: 'token-launcher',
    status: 'completed',
    role: 'token launch specialist',
    delegatedTask: 'Launch $RANDI token on Base',
    completedWork: ['Validated parameters', 'Generated !clawnch post'],
    output: 'The token launch post is ready. Please post it to Moltbook.',
    evidence: [],
    blockedBy: [],
    unresolved: [],
  };

  const formatted = formatSpecialistResponse(envelope);

  expect(formatted).toMatch(/✅ \*TOKEN LAUNCH SPECIALIST REPORT\*/);
  expect(formatted).toMatch(/Launch \$RANDI token on Base/);
  expect(formatted).toMatch(/The token launch post is ready/);
  expect(formatted).toMatch(/- Validated parameters/);
  expect(formatted).toMatch(/- Generated !clawnch post/);
});

it('formatSpecialistResponse handles blocked status with emoji', () => {
  const envelope: SpecialistResponseEnvelope = {
    specialistSlug: 'research-assistant',
    status: 'blocked',
    role: 'research specialist',
    delegatedTask: 'Find price of $RANDI',
    completedWork: [],
    output: 'I could not find the price.',
    evidence: [],
    blockedBy: ['API is down'],
    unresolved: ['Price remains unknown'],
  };

  const formatted = formatSpecialistResponse(envelope);

  expect(formatted).toMatch(/🛑 \*RESEARCH SPECIALIST REPORT\*/);
  expect(formatted).toMatch(/\*Blocked By:\*/);
  expect(formatted).toMatch(/- API is down/);
  expect(formatted).toMatch(/\*Unresolved Issues:\*/);
  expect(formatted).toMatch(/- Price remains unknown/);
});

// ── Orchestration integration tests ──────────────────────────────────────────

describe('runSpecialistDelegation - credit deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failed envelope when deductForAgentCall reports insufficient credits', async () => {
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue(mockAgent as any);
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: false, cost: 500 } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
      },
      'session1'
    );

    const envelope = JSON.parse(result) as SpecialistResponseEnvelope;
    expect(envelope.status).toBe('failed');
    expect(envelope.blockedBy).toContain('Insufficient credits');
    expect(envelope.output).toMatch(/Insufficient credits/i);
  });
});

describe('runSpecialistDelegation - maxTurns enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue(mockAgent as any);
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: true, cost: 100 } as any);
    vi.mocked(evaluateAndRecordPolicy).mockResolvedValue({ decision: 'allow' } as any);
    vi.mocked(executeOpenAIToolCall).mockResolvedValue('tool result');
  });

  it('stops after maxTurns=1 even when specialist keeps requesting tools', async () => {
    // Always returns tool calls → loop would run forever without maxTurns guard
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'tc1', type: 'function', function: { name: 'SOME_TOOL', arguments: '{}' } },
            ],
          },
        },
      ],
    } as any);

    await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 1,
      },
      'session1'
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('stops after maxTurns=5 when specialist keeps requesting tools', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'tc1', type: 'function', function: { name: 'SOME_TOOL', arguments: '{}' } },
            ],
          },
        },
      ],
    } as any);

    await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 5,
      },
      'session1'
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(5);
  });

  it('stops after maxTurns=20 at the upper boundary', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'tc1', type: 'function', function: { name: 'SOME_TOOL', arguments: '{}' } },
            ],
          },
        },
      ],
    } as any);

    await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 20,
      },
      'session1'
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(20);
  });

  it('stops before maxTurns when specialist returns no tool calls', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: 'completed',
              completedWork: [],
              output: 'Done',
              evidence: [],
              blockedBy: [],
              unresolved: [],
            }),
            tool_calls: undefined,
          },
        },
      ],
    } as any);

    await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 10,
      },
      'session1'
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
  });
});

describe('runSpecialistDelegation - policy gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue(mockAgent as any);
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: true, cost: 100 } as any);
  });

  it('injects Policy Denied error into tool result when policy denies the call', async () => {
    const capturedMessages: any[] = [];

    vi.mocked(createChatCompletion).mockImplementation(async ({ messages }) => {
      capturedMessages.push(...messages);
      // First call: return a tool call
      if (capturedMessages.filter(m => m.role === 'tool').length === 0) {
        return {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'tc1',
                    type: 'function',
                    function: { name: 'GMAIL_SEND_EMAIL', arguments: '{"to":"test@example.com"}' },
                  },
                ],
              },
            },
          ],
        } as any;
      }
      // Second call: return final answer after receiving the denied tool result
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'blocked',
                completedWork: [],
                output: 'Blocked by policy',
                evidence: [],
                blockedBy: ['Policy Denied'],
                unresolved: [],
              }),
              tool_calls: undefined,
            },
          },
        ],
      } as any;
    });

    vi.mocked(evaluateAndRecordPolicy).mockResolvedValue({
      decision: 'deny',
      reason: 'email sends are not permitted in automated contexts',
    } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 5,
      },
      'session1'
    );

    // Tool should not have been called (policy denied before executeOpenAIToolCall)
    expect(executeOpenAIToolCall).not.toHaveBeenCalled();

    const toolMessages = capturedMessages.filter(m => m.role === 'tool');
    expect(toolMessages.length).toBeGreaterThan(0);
    expect(toolMessages[0].content).toContain('Policy Denied');
  });

  it('injects manual approval error when policy returns approve', async () => {
    const capturedMessages: any[] = [];

    vi.mocked(createChatCompletion).mockImplementation(async ({ messages }) => {
      capturedMessages.push(...messages);
      if (capturedMessages.filter(m => m.role === 'tool').length === 0) {
        return {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'tc2',
                    type: 'function',
                    function: { name: 'WALLET_SEND_TOKEN', arguments: '{"amount":100}' },
                  },
                ],
              },
            },
          ],
        } as any;
      }
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'blocked',
                completedWork: [],
                output: 'Needs approval',
                evidence: [],
                blockedBy: ['Approval required'],
                unresolved: [],
              }),
              tool_calls: undefined,
            },
          },
        ],
      } as any;
    });

    vi.mocked(evaluateAndRecordPolicy).mockResolvedValue({ decision: 'approve' } as any);

    await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      {
        ...baseArgs,
        maxTurns: 5,
      },
      'session1'
    );

    expect(executeOpenAIToolCall).not.toHaveBeenCalled();
    const toolMessages = capturedMessages.filter(m => m.role === 'tool');
    expect(toolMessages[0].content).toContain('manual approval');
  });
});

describe('conduct_specialists - pre-flight credit check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when user balance is below total estimated cost of all specialists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ tokenBalance: 50 } as any);
    vi.mocked(prisma.agentConfig.findMany).mockResolvedValue([
      { slug: 'research-assistant', defaultModel: 'openai/gpt-4o-mini' },
      { slug: 'seo-assistant', defaultModel: 'openai/gpt-4o-mini' },
    ] as any);
    vi.mocked(getCallCost).mockReturnValue({ finalCost: 100 } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [
          { ...baseArgs, specialistSlug: 'research-assistant' },
          { ...baseArgs, specialistSlug: 'seo-assistant' },
        ],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/Insufficient credits/i);
    expect(parsed.estimatedCost).toBe(200);
    expect(parsed.balance).toBe(50);
  });
});

describe('conduct_specialists - parallel result merging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sufficient balance
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ tokenBalance: 10_000 } as any);
    vi.mocked(prisma.agentConfig.findMany).mockResolvedValue([
      { slug: 'research-assistant', defaultModel: 'openai/gpt-4o-mini' },
      { slug: 'seo-assistant', defaultModel: 'openai/gpt-4o-mini' },
    ] as any);
    vi.mocked(getCallCost).mockReturnValue({ finalCost: 100 } as any);
    (vi.mocked(prisma.agentConfig.findUnique) as any).mockImplementation(
      async ({ where }: any) => ({
        slug: where.slug,
        systemPrompt: 'You are a specialist.',
        defaultModel: 'openai/gpt-4o-mini',
        tools: null,
      })
    );
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: true, cost: 100 } as any);
  });

  it('returns overall status=completed when all specialists complete successfully', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: 'completed',
              completedWork: ['Done'],
              output: 'All good',
              evidence: [],
              blockedBy: [],
              unresolved: [],
            }),
            tool_calls: undefined,
          },
        },
      ],
    } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [
          { ...baseArgs, specialistSlug: 'research-assistant' },
          { ...baseArgs, specialistSlug: 'seo-assistant' },
        ],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('completed');
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].status).toBe('completed');
    expect(parsed.results[1].status).toBe('completed');
  });

  it('returns overall status=partial when at least one specialist fails', async () => {
    let callCount = 0;
    vi.mocked(createChatCompletion).mockImplementation(async () => {
      callCount++;
      const status = callCount === 1 ? 'completed' : 'failed';
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                status,
                completedWork: [],
                output: 'result',
                evidence: [],
                blockedBy: [],
                unresolved: [],
              }),
              tool_calls: undefined,
            },
          },
        ],
      } as any;
    });

    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [
          { ...baseArgs, specialistSlug: 'research-assistant' },
          { ...baseArgs, specialistSlug: 'seo-assistant' },
        ],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('partial');
    expect(parsed.results).toHaveLength(2);
  });

  it('returns error when no delegations are provided', async () => {
    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/No delegations/i);
  });

  it('returns error when more than MAX_PARALLEL_SPECIALISTS (5) are requested', async () => {
    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [
          { ...baseArgs, specialistSlug: 'research-assistant' },
          { ...baseArgs, specialistSlug: 'seo-assistant' },
          { ...baseArgs, specialistSlug: 'code-assistant' },
          { ...baseArgs, specialistSlug: 'token-launcher' },
          { ...baseArgs, specialistSlug: 'productivity-agent' },
          { ...baseArgs, specialistSlug: 'audit-assistant' },
        ],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/Too many parallel specialists/i);
    expect(parsed.error).toMatch(/5/);
  });

  it('retries failed specialists once via bounded recovery loop', async () => {
    let callCount = 0;
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ tokenBalance: 10_000 } as any);
    vi.mocked(prisma.agentConfig.findMany).mockResolvedValue([
      { slug: 'research-assistant', defaultModel: 'openai/gpt-4o-mini' },
    ] as any);
    vi.mocked(getCallCost).mockReturnValue({ finalCost: 100 } as any);
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue({
      slug: 'research-assistant',
      systemPrompt: 'You are a specialist.',
      defaultModel: 'openai/gpt-4o-mini',
      tools: null,
    } as any);
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: true, cost: 100 } as any);

    vi.mocked(createChatCompletion).mockImplementation(async () => {
      callCount++;
      return {
        choices: [
          {
            message: {
              content:
                callCount === 1
                  ? JSON.stringify({
                      status: 'failed',
                      completedWork: [],
                      output: 'Retry me',
                      evidence: [],
                      blockedBy: [],
                      unresolved: [],
                    })
                  : JSON.stringify({
                      status: 'completed',
                      completedWork: ['Done'],
                      output: 'OK',
                      evidence: [],
                      blockedBy: [],
                      unresolved: [],
                    }),
              tool_calls: undefined,
            },
          },
        ],
      } as any;
    });

    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [{ ...baseArgs, specialistSlug: 'research-assistant' }],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    // First attempt failed, retry succeeded
    expect(createChatCompletion).toHaveBeenCalledTimes(2);
    expect(parsed.results[0].status).toBe('completed');
  });

  it('returns credit check error when pre-flight credit check throws', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB error'));

    const result = await executeOrchestrationToolCall(
      'user1',
      'conduct_specialists',
      {
        delegations: [{ ...baseArgs, specialistSlug: 'research-assistant' }],
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/Credit check failed/i);
  });
});

describe('runSpecialistDelegation - agent not found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failed envelope when agent config is not found', async () => {
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue(null);

    const result = await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      baseArgs,
      'session1'
    );

    const envelope = JSON.parse(result) as SpecialistResponseEnvelope;
    expect(envelope.status).toBe('failed');
    expect(envelope.blockedBy).toContain("Specialist agent 'research-assistant' not found.");
    expect(envelope.unresolved).toContain('Delegated task did not start.');
  });

  it('returns failed envelope when createChatCompletion throws', async () => {
    vi.mocked(prisma.agentConfig.findUnique).mockResolvedValue(mockAgent as any);
    vi.mocked(deductForAgentCall).mockResolvedValue({ success: true, cost: 100 } as any);
    vi.mocked(createChatCompletion).mockRejectedValue(new Error('Model unavailable'));

    const result = await executeOrchestrationToolCall(
      'user1',
      'delegate_to_specialist',
      baseArgs,
      'session1'
    );

    const envelope = JSON.parse(result) as SpecialistResponseEnvelope;
    expect(envelope.status).toBe('failed');
    expect(envelope.output).toMatch(/Specialist execution failed/i);
    expect(envelope.blockedBy).toContain('Model unavailable');
  });
});

describe('executeOrchestrationToolCall - spawn_autonomous_developer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when getBestBridgeNode returns null', async () => {
    vi.mocked(getBestBridgeNode).mockResolvedValue(null);

    const result = await executeOrchestrationToolCall(
      'user1',
      'spawn_autonomous_developer',
      {
        project: 'my-project',
        task: 'fix the bug',
        agent: 'claude-code',
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/not configured or no nodes available/i);
  });

  it('returns error when COMPUTE_BRIDGE_API_KEY is not set', async () => {
    vi.mocked(getBestBridgeNode).mockResolvedValue({
      getBaseUrl: () => 'http://bridge.local',
      getNodeId: () => 'node-1',
    } as any);
    delete process.env.COMPUTE_BRIDGE_API_KEY;

    const result = await executeOrchestrationToolCall(
      'user1',
      'spawn_autonomous_developer',
      {
        project: 'my-project',
        task: 'fix the bug',
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/COMPUTE_BRIDGE_API_KEY/i);
    process.env.COMPUTE_BRIDGE_API_KEY = 'test-key';
  });

  it('returns error when bridge responds with non-OK', async () => {
    const originalFetch = global.fetch;
    vi.mocked(getBestBridgeNode).mockResolvedValue({
      getBaseUrl: () => 'http://bridge.local',
      getNodeId: () => 'node-1',
    } as any);
    process.env.COMPUTE_BRIDGE_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Node overloaded' }),
    } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'spawn_autonomous_developer',
      {
        project: 'my-project',
        task: 'fix the bug',
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/Node overloaded/i);
    global.fetch = originalFetch;
  });
});

describe('executeOrchestrationToolCall - browse_web', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns error when bridge is unavailable', async () => {
    vi.mocked(getBestBridgeNode).mockResolvedValue(null);

    const result = await executeOrchestrationToolCall(
      'user1',
      'browse_web',
      {
        url: 'https://example.com',
        action: 'snapshot',
      },
      'session1'
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/not configured or no nodes available/i);
  });

  it('returns snapshot output when bridge responds OK', async () => {
    vi.mocked(getBestBridgeNode).mockResolvedValue({
      getBaseUrl: () => 'http://bridge.local',
      getNodeId: () => 'node-1',
    } as any);
    process.env.COMPUTE_BRIDGE_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ output: 'Page content here' }),
    } as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'browse_web',
      {
        url: 'https://example.com',
        action: 'snapshot',
      },
      'session1'
    );

    expect(result).toMatch(/Page content here/);
    expect(result).toMatch(/node-1/);
  });
});

describe('executeOrchestrationToolCall - list_available_skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns formatted list when skills are found', async () => {
    const { SkillManager } = await import('@/lib/skills/manager');
    vi.mocked(SkillManager.listSkills).mockResolvedValue([
      { id: 'webapp-testing', description: 'Test web apps end-to-end' },
      { id: 'api-design', description: 'Design REST APIs' },
    ] as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'list_available_skills',
      {},
      'session1'
    );

    expect(result).toMatch(/Available specialized skills/);
    expect(result).toMatch(/webapp-testing/);
    expect(result).toMatch(/api-design/);
  });

  it('returns no skills message when list is empty', async () => {
    const { SkillManager } = await import('@/lib/skills/manager');
    vi.mocked(SkillManager.listSkills).mockResolvedValue([] as any);

    const result = await executeOrchestrationToolCall(
      'user1',
      'list_available_skills',
      {},
      'session1'
    );

    expect(result).toBe('No specialized skills found in library.');
  });
});

describe('executeOrchestrationToolCall - load_skill_context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns skill content when skill is found', async () => {
    const { SkillManager } = await import('@/lib/skills/manager');
    vi.mocked(SkillManager.getSkillContent).mockResolvedValue(
      '## Skill Instructions\n\nUse Playwright to test.'
    );

    const result = await executeOrchestrationToolCall(
      'user1',
      'load_skill_context',
      {
        skillId: 'webapp-testing',
      },
      'session1'
    );

    expect(result).toMatch(/Skill Context: webapp-testing/);
    expect(result).toMatch(/Playwright/);
  });

  it('returns not found when skill does not exist', async () => {
    const { SkillManager } = await import('@/lib/skills/manager');
    vi.mocked(SkillManager.getSkillContent).mockResolvedValue(null);

    const result = await executeOrchestrationToolCall(
      'user1',
      'load_skill_context',
      {
        skillId: 'nonexistent-skill',
      },
      'session1'
    );

    expect(result).toMatch(/not found/i);
  });
});
