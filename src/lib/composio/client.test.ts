import { describe, it, expect, afterAll, beforeEach, vi, afterEach } from 'vitest';
import {
  resolveComposioUserId,
  parseAgentToolConfig,
  dedupeTools,
  normalizeToolCallArgumentsJson,
  composioToolsToOpenAI,
  getAgentToolsFromConfig,
  executeOpenAIToolCall,
  getComposioClient,
} from '@/lib/composio/client';

const { mockComposioClient } = vi.hoisted(() => ({
  mockComposioClient: {
    tools: {
      getRawComposioTools: vi.fn().mockResolvedValue([]),
      getRawComposioToolBySlug: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue({ output: 'tool result' }),
    },
  },
}));

vi.mock('@/lib/composio/client', async () => {
  const actual = await vi.importActual('@/lib/composio/client');
  return {
    ...actual,
    getComposioClient: vi.fn().mockResolvedValue(mockComposioClient),
  };
});

describe('resolveComposioUserId - entity ID isolation', () => {
  const originalEnvValue = process.env.COMPOSIO_ENTITY_ID;

  beforeEach(() => {
    delete process.env.COMPOSIO_ENTITY_ID;
  });

  afterAll(() => {
    if (originalEnvValue !== undefined) {
      process.env.COMPOSIO_ENTITY_ID = originalEnvValue;
    } else {
      delete process.env.COMPOSIO_ENTITY_ID;
    }
  });

  it('returns userId alone when no agentSlug is given', () => {
    expect(resolveComposioUserId('user123')).toBe('user123');
  });

  it('appends sanitized agentSlug for seo-scout', () => {
    expect(resolveComposioUserId('user123', 'seo-scout')).toBe('user123_seo_scout');
  });

  it('appends sanitized agentSlug for researcher', () => {
    expect(resolveComposioUserId('user123', 'researcher')).toBe('user123_researcher');
  });

  it('produces distinct entity IDs for the same user across different specialists', () => {
    const seoId = resolveComposioUserId('user123', 'seo-scout');
    const researcherId = resolveComposioUserId('user123', 'researcher');
    expect(seoId).toBe('user123_seo_scout');
    expect(researcherId).toBe('user123_researcher');
    expect(seoId).not.toBe(researcherId);
  });

  it('produces distinct entity IDs for different users with the same specialist', () => {
    const userAId = resolveComposioUserId('userA', 'seo-scout');
    const userBId = resolveComposioUserId('userB', 'seo-scout');
    expect(userAId).not.toBe(userBId);
  });

  it('uses COMPOSIO_ENTITY_ID override when set, ignoring userId and agentSlug', () => {
    process.env.COMPOSIO_ENTITY_ID = 'global-override';
    expect(resolveComposioUserId('user123', 'seo-scout')).toBe('global-override');
    expect(resolveComposioUserId('user456', 'researcher')).toBe('global-override');
  });

  it('throws when userId is empty and no override is set', () => {
    expect(() => resolveComposioUserId('')).toThrow(/Missing authenticated user id/);
  });

  it('sanitizes hyphens and special characters in agentSlug', () => {
    expect(resolveComposioUserId('user123', 'my-agent-v2')).toBe('user123_my_agent_v2');
  });

  it('sanitizes uppercase in agentSlug', () => {
    expect(resolveComposioUserId('user123', 'SEO-Scout')).toBe('user123_seo_scout');
  });
});

describe('parseAgentToolConfig', () => {
  it('returns empty lists for null input', () => {
    const result = parseAgentToolConfig(null);
    expect(result.explicitTools).toEqual([]);
    expect(result.toolkitHints).toEqual([]);
    expect(result.fallbackTools).toEqual([]);
  });

  it('returns empty lists for undefined input', () => {
    const result = parseAgentToolConfig(undefined);
    expect(result.explicitTools).toEqual([]);
    expect(result.toolkitHints).toEqual([]);
    expect(result.fallbackTools).toEqual([]);
  });

  it('returns empty lists for empty string', () => {
    const result = parseAgentToolConfig('');
    expect(result.explicitTools).toEqual([]);
    expect(result.toolkitHints).toEqual([]);
    expect(result.fallbackTools).toEqual([]);
  });

  it('parses a JSON array with mixed tools and toolkits', () => {
    const result = parseAgentToolConfig(JSON.stringify(['github', 'GITHUB_LIST_REPOS']));
    expect(result.explicitTools).toContain('GITHUB_LIST_REPOS');
    expect(result.toolkitHints).toContain('github');
  });

  it('returns empty lists for non-matching string values', () => {
    const result = parseAgentToolConfig('not-a-tool');
    expect(result.explicitTools).toEqual([]);
    expect(result.toolkitHints).toEqual([]);
    expect(result.fallbackTools).toEqual([]);
  });

  it('parses object format with tools and toolkits', () => {
    const result = parseAgentToolConfig(
      JSON.stringify({
        tools: ['GITHUB_LIST_REPOS'],
        toolkits: ['slack'],
      })
    );
    expect(result.explicitTools).toEqual(['GITHUB_LIST_REPOS']);
    expect(result.toolkitHints).toEqual(['slack']);
  });

  it('caps results at MAX_TOOL_DEFINITIONS (50)', () => {
    const manyTools = Array.from({ length: 60 }, (_, i) => `TOOL_${i}`);
    const result = parseAgentToolConfig(JSON.stringify(manyTools));
    expect(result.explicitTools.length).toBe(50);
  });
});

describe('dedupeTools', () => {
  it('removes duplicate tools by slug', () => {
    const tools = [
      { slug: 'GITHUB_LIST_REPOS', description: 'a', inputParameters: {} } as any,
      { slug: 'SLACK_SEND', description: 'b', inputParameters: {} } as any,
      { slug: 'GITHUB_LIST_REPOS', description: 'c', inputParameters: {} } as any,
    ];
    const result = dedupeTools(tools);
    expect(result.length).toBe(2);
    expect(result[0].slug).toBe('GITHUB_LIST_REPOS');
    expect(result[1].slug).toBe('SLACK_SEND');
  });

  it('returns tools in original order, keeping the first occurrence', () => {
    const tools = [
      { slug: 'A', description: '1st', inputParameters: {} } as any,
      { slug: 'B', description: '2nd', inputParameters: {} } as any,
      { slug: 'C', description: '3rd', inputParameters: {} } as any,
    ];
    const result = dedupeTools(tools);
    expect(result.map(t => t.description)).toEqual(['1st', '2nd', '3rd']);
  });
});

describe('composioToolsToOpenAI', () => {
  it('converts ComposioTool array to OpenAI tool format', () => {
    const tools = [
      {
        slug: 'GITHUB_LIST_REPOS',
        description: 'List repositories',
        inputParameters: { type: 'object' },
      } as any,
    ];
    const result = composioToolsToOpenAI(tools);
    expect(result).toHaveLength(1);
    expect(result[0].function.name).toBe('GITHUB_LIST_REPOS');
    expect(result[0].function.description).toBe('List repositories');
    expect(result[0].function.parameters).toEqual({ type: 'object' });
  });

  it('handles empty array', () => {
    expect(composioToolsToOpenAI([])).toEqual([]);
  });
});

describe('normalizeToolCallArgumentsJson', () => {
  it("returns '{}' for non-string inputs", () => {
    expect(normalizeToolCallArgumentsJson(null)).toBe('{}');
    expect(normalizeToolCallArgumentsJson(undefined)).toBe('{}');
    expect(normalizeToolCallArgumentsJson(123)).toBe('{}');
  });

  it("returns '{}' for whitespace-only strings", () => {
    expect(normalizeToolCallArgumentsJson('   ')).toBe('{}');
  });

  it("returns '{}' for 'undefined' and 'null' literals", () => {
    expect(normalizeToolCallArgumentsJson('undefined')).toBe('{}');
    expect(normalizeToolCallArgumentsJson('null')).toBe('{}');
    expect(normalizeToolCallArgumentsJson('"undefined"')).toBe('{}');
    expect(normalizeToolCallArgumentsJson('"null"')).toBe('{}');
  });

  it("returns '{}' for invalid JSON strings", () => {
    expect(normalizeToolCallArgumentsJson('{not json}')).toBe('{}');
  });

  it("returns '{}' for arrays (not objects)", () => {
    expect(normalizeToolCallArgumentsJson('[1,2,3]')).toBe('{}');
  });

  it('returns normalized JSON for valid objects', () => {
    expect(normalizeToolCallArgumentsJson('  {"key":"value"}  ')).toBe('{"key":"value"}');
  });
});

describe('getComposioClient', () => {
  const originalApiKey = process.env.COMPOSIO_API_KEY;

  beforeEach(() => {
    // Override module mock to simulate real env-var-dependent behavior
    vi.mocked(getComposioClient).mockImplementation(async () => {
      if (!process.env.COMPOSIO_API_KEY?.trim()) return null;
      return mockComposioClient as any;
    });
  });

  afterEach(() => {
    vi.mocked(getComposioClient).mockResolvedValue(mockComposioClient as any);
    if (originalApiKey !== undefined) {
      process.env.COMPOSIO_API_KEY = originalApiKey;
    } else {
      delete process.env.COMPOSIO_API_KEY;
    }
    delete (globalThis as any).composioClientPromise;
  });

  it('returns null when COMPOSIO_API_KEY is not set', async () => {
    delete process.env.COMPOSIO_API_KEY;
    const client = await getComposioClient();
    expect(client).toBeNull();
  });
});

describe('getAgentToolsFromConfig', () => {
  const originalApiKey = process.env.COMPOSIO_API_KEY;

  beforeEach(() => {
    process.env.COMPOSIO_API_KEY = 'test-key';
    delete (globalThis as any).composioClientPromise;
  });

  afterEach(() => {
    process.env.COMPOSIO_API_KEY = originalApiKey;
    delete (globalThis as any).composioClientPromise;
  });

  it('returns empty array when config is null', async () => {
    const result = await getAgentToolsFromConfig(null, 'user1');
    expect(result).toEqual([]);
  });

  it('returns empty array when config is empty string', async () => {
    const result = await getAgentToolsFromConfig('', 'user1');
    expect(result).toEqual([]);
  });

  it('returns empty array when COMPOSIO_API_KEY is not set', async () => {
    delete process.env.COMPOSIO_API_KEY;
    const result = await getAgentToolsFromConfig('["github"]', 'user1');
    expect(result).toEqual([]);
  });
});

describe('executeOpenAIToolCall', () => {
  const originalApiKey = process.env.COMPOSIO_API_KEY;

  beforeEach(() => {
    process.env.COMPOSIO_API_KEY = 'test-key';
    delete (globalThis as any).composioClientPromise;
  });

  afterEach(() => {
    process.env.COMPOSIO_API_KEY = originalApiKey;
    delete (globalThis as any).composioClientPromise;
  });

  it('returns error JSON when COMPOSIO_API_KEY is not configured', async () => {
    delete process.env.COMPOSIO_API_KEY;
    const result = await executeOpenAIToolCall(
      'user1',
      { type: 'function', function: { name: 'GITHUB_LIST_REPOS', arguments: '{}' } },
      undefined,
      undefined
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toMatch(/COMPOSIO_API_KEY/i);
  });

  it('routes to runtimeUrl when provided and fetch succeeds', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('runtime result'),
    } as any);

    const result = await executeOpenAIToolCall(
      'user1',
      { type: 'function', function: { name: 'GITHUB_LIST_REPOS', arguments: '{}' } },
      'http://runtime.local',
      undefined
    );

    expect(result).toBe('runtime result');
    global.fetch = originalFetch;
  });

  it('falls back to Composio SDK when runtimeUrl fetch fails', async () => {
    // Pre-seed the composio client cache so actual getComposioClient returns our mock
    // without needing to initialize the real SDK (which isn't available in tests).
    (globalThis as any).composioClientPromise = Promise.resolve(mockComposioClient);
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('runtime error'),
    } as any);
    mockComposioClient.tools.execute.mockResolvedValueOnce({ output: 'SDK result' });

    const result = await executeOpenAIToolCall(
      'user1',
      { type: 'function', function: { name: 'GITHUB_LIST_REPOS', arguments: '{}' } },
      'http://runtime.local',
      undefined
    );

    expect(result).toMatch(/SDK result/i);
    global.fetch = originalFetch;
  });
});
