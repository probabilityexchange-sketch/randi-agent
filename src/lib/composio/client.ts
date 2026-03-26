import type { Composio as ComposioClient, Tool as ComposioTool } from '@composio/core';

const globalForComposio = globalThis as unknown as {
  composioClientPromise?: Promise<ComposioClient | null>;
};
let loggedMissingComposioApiKey = false;

export type { ComposioTool };

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export function composioToolsToOpenAI(tools: ComposioTool[]): OpenAITool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.slug,
      description: t.description || '',
      parameters: t.inputParameters,
    },
  }));
}

export async function getComposioClient(): Promise<ComposioClient | null> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim() || '';
  if (!apiKey) {
    if (!loggedMissingComposioApiKey) {
      console.warn('COMPOSIO_API_KEY is not set in environment variables');
      loggedMissingComposioApiKey = true;
    }
    return null;
  }

  if (!globalForComposio.composioClientPromise) {
    globalForComposio.composioClientPromise = (async () => {
      try {
        const { Composio } = await import('@composio/core');
        return new Composio({ apiKey }) as ComposioClient;
      } catch (error) {
        console.error('Failed to initialize Composio client', error);
        return null;
      }
    })();
  }

  return globalForComposio.composioClientPromise;
}

const MAX_TOOL_DEFINITIONS = 50;
const TOOL_SLUG_PATTERN = /^[A-Z0-9_]+$/;
const TOOLKIT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

// Curated allowlists: only the most useful tools per toolkit.
// Toolkits NOT in this map get all tools (capped at 15).
const CURATED_TOOLKIT_TOOLS: Record<string, string[]> = {
  gmail: [
    'GMAIL_FETCH_EMAILS',
    'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID',
    'GMAIL_FETCH_MESSAGE_BY_THREAD_ID',
    'GMAIL_CREATE_EMAIL_DRAFT',
    'GMAIL_SEND_EMAIL',
    'GMAIL_REPLY_TO_THREAD',
    'GMAIL_FORWARD_MESSAGE',
    'GMAIL_GET_PROFILE',
    'GMAIL_ADD_LABEL_TO_EMAIL',
    'GMAIL_GET_ATTACHMENT',
  ],
  googlecalendar: [
    'GOOGLECALENDAR_FIND_EVENT',
    'GOOGLECALENDAR_LIST_CALENDARS',
    'GOOGLECALENDAR_GET_CALENDAR',
    'GOOGLECALENDAR_CREATE_EVENT',
    'GOOGLECALENDAR_UPDATE_EVENT',
    'GOOGLECALENDAR_DELETE_EVENT',
    'GOOGLECALENDAR_FIND_FREE_SLOTS',
    'GOOGLECALENDAR_QUICK_ADD_EVENT',
  ],
  github: [
    'GITHUB_LIST_PULL_REQUESTS',
    'GITHUB_GET_A_PULL_REQUEST',
    'GITHUB_CREATE_A_PULL_REQUEST',
    'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
    'GITHUB_GET_A_REPOSITORY',
    'GITHUB_CREATE_AN_ISSUE',
    'GITHUB_LIST_REPOSITORY_ISSUES',
    'GITHUB_GET_AN_ISSUE',
    'GITHUB_CREATE_AN_ISSUE_COMMENT',
    'GITHUB_SEARCH_CODE',
    'GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS',
    'GITHUB_LIST_COMMITS',
    'GITHUB_GET_A_BRANCH',
    'GITHUB_LIST_BRANCHES',
    'GITHUB_CREATE_A_FORK',
    'GITHUB_GET_COMMITS_OF_A_PULL_REQUEST',
    'GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER',
  ],
  slack: [
    'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
    'SLACK_LIST_ALL_CHANNELS',
    'SLACK_LIST_ALL_USERS',
    'SLACK_FIND_CHANNELS',
    'SLACK_FIND_USERS',
    'SLACK_OPEN_DM',
    'SLACK_LIST_CONVERSATIONS',
    'SLACK_LIST_STARRED_ITEMS',
    'SLACK_ADD_REACTION',
    'SLACK_SEARCH_FOR_MESSAGES',
  ],
  notion: [
    'NOTION_SEARCH_NOTION_PAGE',
    'NOTION_CREATE_NOTION_PAGE',
    'NOTION_RETRIEVE_PAGE',
    'NOTION_UPDATE_PAGE',
    'NOTION_QUERY_DATABASE',
    'NOTION_INSERT_ROW_DATABASE',
    'NOTION_FETCH_ALL_BLOCK_CONTENTS',
    'NOTION_ADD_PAGE_CONTENT',
    'NOTION_LIST_DATABASES',
    'NOTION_LIST_USERS',
  ],
  coinmarketcap: [
    'COINMARKETCAP_CRYPTOCURRENCY_LISTINGS_LATEST',
    'COINMARKETCAP_CRYPTOCURRENCY_QUOTES_LATEST',
    'COINMARKETCAP_GET_CRYPTOCURRENCY_INFO',
    'COINMARKETCAP_GLOBAL_METRICS_QUOTES_LATEST',
    'COINMARKETCAP_CMC_EXCHANGE_LISTINGS_HISTORICAL',
    'COINMARKETCAP_TOOLS_PRICE_CONVERSION',
    'COINMARKETCAP_GET_KEY_INFO',
  ],
  telegram: [
    'TELEGRAM_SEND_MESSAGE',
    'TELEGRAM_GET_ME',
    'TELEGRAM_LIST_CHATS',
    'TELEGRAM_GET_CHAT',
    'TELEGRAM_EDIT_MESSAGE_TEXT',
  ],
  youtube: [
    'YOUTUBE_SEARCH_VIDEOS',
    'YOUTUBE_LIST_CHANNEL_VIDEOS',
    'YOUTUBE_GET_VIDEO_DETAILS',
    'YOUTUBE_LIST_MY_VIDEOS',
    'YOUTUBE_LIST_PLAYLISTS',
  ],
  openweather: [
    'OPENWEATHER_GET_CURRENT_WEATHER_DATA',
    'OPENWEATHER_GET_5_DAY_3_HOUR_FORECAST_DATA',
    'OPENWEATHER_GET_WEATHER_MAPS',
    'OPENWEATHER_GET_AIR_POLLUTION_DATA',
  ],
  googlesheets: [
    'GOOGLESHEETS_GET_SPREADSHEET',
    'GOOGLESHEETS_BATCH_GET_VALUES',
    'GOOGLESHEETS_GET_VALUES',
    'GOOGLESHEETS_UPDATE_VALUES',
    'GOOGLESHEETS_BATCH_UPDATE_VALUES',
    'GOOGLESHEETS_APPEND_VALUES',
    'GOOGLESHEETS_CLEAR_VALUES',
    'GOOGLESHEETS_CREATE_SPREADSHEET',
    'GOOGLESHEETS_ADD_SHEET',
    'GOOGLESHEETS_DELETE_SHEET',
  ],
  firehose: [
    'FIREHOSE_LIST_TAPS',
    'FIREHOSE_CREATE_TAP',
    'FIREHOSE_GET_TAP',
    'FIREHOSE_REVOKE_TAP',
    'FIREHOSE_LIST_RULES',
    'FIREHOSE_CREATE_RULE',
    'FIREHOSE_UPDATE_RULE',
    'FIREHOSE_DELETE_RULE',
    'FIREHOSE_GET_STREAM',
  ],
};

const LEGACY_TOOLKIT_ALIASES: Record<string, string> = {
  github_api: 'github',
  slack_api: 'slack',
  notion_api: 'notion',
  google_calendar: 'googlecalendar',
  google_sheets: 'googlesheets',
  prompmate_api: 'prompmate',
  promptmate_api: 'prompmate',
  promptmate: 'prompmate',
  coinmarketcap_api: 'coinmarketcap',
  cmc_api: 'coinmarketcap',
  cmc: 'coinmarketcap',
  supabase_api: 'supabase',
  vercel_api: 'vercel',
  telegram_api: 'telegram',
  youtube: 'youtube-vrqivy',
  openweather_api: 'openweather',
};

interface ParsedAgentToolConfig {
  explicitTools: string[];
  toolkitHints: string[];
  fallbackTools: string[];
}

export function resolveComposioUserId(userId: string, agentSlug?: string): string {
  const override = process.env.COMPOSIO_ENTITY_ID?.trim();
  if (override) return override;

  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    throw new Error('Missing authenticated user id for Composio user mapping');
  }

  if (agentSlug) {
    // Sanitize slug for entity ID compatibility
    const cleanSlug = agentSlug.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${normalizedUserId}_${cleanSlug}`;
  }

  return normalizedUserId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  );
}

function normalizeToolkitHint(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const mapped = LEGACY_TOOLKIT_ALIASES[normalized] ?? normalized;
  return TOOLKIT_SLUG_PATTERN.test(mapped) ? mapped : null;
}

export function parseAgentToolConfig(rawConfig: string | null | undefined): ParsedAgentToolConfig {
  if (!rawConfig) {
    return { explicitTools: [], toolkitHints: [], fallbackTools: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    return { explicitTools: [], toolkitHints: [], fallbackTools: [] };
  }

  if (Array.isArray(parsed)) {
    const values = normalizeStringList(parsed);
    const explicitTools = values.filter(value => TOOL_SLUG_PATTERN.test(value));
    const toolkitHints = values
      .map(normalizeToolkitHint)
      .filter((value): value is string => Boolean(value));

    return {
      explicitTools: explicitTools.slice(0, MAX_TOOL_DEFINITIONS),
      toolkitHints: unique(toolkitHints).slice(0, MAX_TOOL_DEFINITIONS),
      fallbackTools: values.slice(0, MAX_TOOL_DEFINITIONS),
    };
  }

  if (!isRecord(parsed)) {
    return { explicitTools: [], toolkitHints: [], fallbackTools: [] };
  }

  const explicitTools = normalizeStringList(parsed.tools).slice(0, MAX_TOOL_DEFINITIONS);
  const toolkitHints = normalizeStringList(parsed.toolkits)
    .map(normalizeToolkitHint)
    .filter((value): value is string => Boolean(value))
    .slice(0, MAX_TOOL_DEFINITIONS);

  return {
    explicitTools,
    toolkitHints: unique(toolkitHints),
    fallbackTools: explicitTools,
  };
}

export function dedupeTools(tools: ComposioTool[]): ComposioTool[] {
  const seen = new Set<string>();
  const deduped: ComposioTool[] = [];

  for (const tool of tools) {
    const key = tool.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tool);
  }

  return deduped;
}

type ComposioToolQuery =
  | { kind: 'tools'; tools: string[] }
  | { kind: 'toolkits'; toolkits: string[] };

export async function fetchToolsByQuery(
  composioClient: ComposioClient,
  query: ComposioToolQuery
): Promise<ComposioTool[]> {
  try {
    const tools =
      query.kind === 'tools'
        ? await composioClient.tools.getRawComposioTools({ tools: query.tools })
        : await composioClient.tools.getRawComposioTools({
            toolkits: query.toolkits,
          });
    return tools;
  } catch (error) {
    console.warn('[Composio] Tool query failed:', query, error);
    return [];
  }
}

export async function fetchToolBySlug(
  composioClient: ComposioClient,
  slug: string
): Promise<ComposioTool | null> {
  try {
    const tool = await composioClient.tools.getRawComposioToolBySlug(slug);
    return tool ?? null;
  } catch {
    return null;
  }
}

export async function getAgentToolsFromConfig(
  rawConfig: string | null | undefined,
  userId: string,
  agentSlug?: string
): Promise<ComposioTool[]> {
  const composioClient = await getComposioClient();
  if (!composioClient) return [];
  const resolvedUserId = resolveComposioUserId(userId, agentSlug);

  const parsed = parseAgentToolConfig(rawConfig);
  if (
    parsed.explicitTools.length === 0 &&
    parsed.toolkitHints.length === 0 &&
    parsed.fallbackTools.length === 0
  ) {
    return [];
  }

  const collectedTools: ComposioTool[] = [];

  if (parsed.explicitTools.length > 0) {
    collectedTools.push(
      ...(await fetchToolsByQuery(composioClient, {
        kind: 'tools',
        tools: parsed.explicitTools,
      }))
    );
  }

  if (parsed.toolkitHints.length > 0) {
    const FALLBACK_LIMIT = 15;
    const toolkitResults = await Promise.all(
      parsed.toolkitHints.map(toolkit =>
        fetchToolsByQuery(composioClient, {
          kind: 'toolkits',
          toolkits: [toolkit],
        }).then(tools => {
          const allowlist = CURATED_TOOLKIT_TOOLS[toolkit];
          let filtered: ComposioTool[];
          if (allowlist) {
            const allowSet = new Set(allowlist);
            filtered = tools.filter(t => {
              return allowSet.has(t.slug);
            });
            console.log(
              `[Composio] Toolkit "${toolkit}": ${tools.length} total, ${filtered.length} curated (allowlist: ${allowlist.length})`
            );
          } else {
            filtered = tools.slice(0, FALLBACK_LIMIT);
            console.log(
              `[Composio] Toolkit "${toolkit}": ${tools.length} total, capped to ${filtered.length}`
            );
          }
          return filtered;
        })
      )
    );
    for (const tools of toolkitResults) {
      collectedTools.push(...tools);
    }
  }

  if (collectedTools.length === 0) {
    for (const fallbackTool of parsed.fallbackTools) {
      const tool = await fetchToolBySlug(composioClient, fallbackTool);
      if (tool) collectedTools.push(tool);
    }
  }

  const finalTools = dedupeTools(collectedTools);
  console.log(`[Composio] Collected ${finalTools.length} tools for user ${resolvedUserId}`);
  if (finalTools.length > 0) {
    const prefixes = new Set(finalTools.map(t => t.slug.split('_')[0]));
    console.log(`[Composio] Tools found for prefixes: ${Array.from(prefixes).join(', ')}`);
  }
  return finalTools;
}

export async function executeOpenAIToolCall(
  userId: string,
  toolCall:
    | { type?: string; function?: { name: string; arguments: string } }
    | { name: string; arguments: string | Record<string, unknown> },
  runtimeUrl?: string,
  agentSlug?: string
): Promise<string> {
  const resolvedUserId = resolveComposioUserId(userId, agentSlug);

  let toolName: string;
  let toolArgs: Record<string, unknown>;

  if ('function' in toolCall && toolCall.function) {
    if (toolCall.type !== 'function') {
      return JSON.stringify({ error: 'Only function tool calls are supported.' });
    }
    const normalized = normalizeToolCallArgumentsJson(toolCall.function.arguments);
    toolName = toolCall.function.name;
    toolArgs = JSON.parse(normalized);
  } else if ('name' in toolCall) {
    toolName = toolCall.name;
    toolArgs =
      typeof (toolCall as any).arguments === 'string'
        ? JSON.parse((toolCall as any).arguments)
        : (toolCall as any).arguments || {};
  } else {
    return JSON.stringify({ error: 'Invalid tool call format' });
  }

  // ── DEDICATED RUNTIME ROUTING ──────────────────────────────────────────
  if (runtimeUrl) {
    try {
      const endpoint = new URL('/api/tools/execute', runtimeUrl).toString();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resolvedUserId,
          toolName,
          arguments: toolArgs,
        }),
      });

      if (response.ok) {
        return await response.text();
      }

      const errorText = await response.text();
      console.warn(`Dedicated tool execution failed at ${runtimeUrl}:`, errorText);
    } catch (error) {
      console.error(`Failed to reach dedicated runtime at ${runtimeUrl}:`, error);
    }
  }

  // Fallback to Composio SDK execution — only needs the client here
  const composioClient = await getComposioClient();
  if (!composioClient) {
    return JSON.stringify({ error: 'COMPOSIO_API_KEY is not configured.' });
  }
  try {
    console.log(`[Composio] Executing tool: ${toolName} for entity: ${resolvedUserId}`);
    console.log(`[Composio] Args: ${JSON.stringify(toolArgs)}`);
    console.log(
      `[Composio] COMPOSIO_ENTITY_ID env: ${process.env.COMPOSIO_ENTITY_ID ? 'SET' : 'NOT SET'}`
    );

    const result = await composioClient.tools.execute(toolName, {
      userId: resolvedUserId,
      arguments: toolArgs,
      dangerouslySkipVersionCheck: true,
    });

    console.log(`[Composio] Tool ${toolName} executed successfully`);
    return JSON.stringify(result);
  } catch (error) {
    const err = error as any;
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    const stack = err?.stack || '';
    console.error(`[Composio] Tool execution error for ${toolName}:`, message, stack);
    return JSON.stringify({
      error: message,
      tool: toolName,
      details: err?.response?.data || err?.cause || null,
    });
  }
}

export function normalizeToolCallArgumentsJson(rawArgs: unknown): string {
  if (typeof rawArgs !== 'string') return '{}';

  const trimmed = rawArgs.trim();
  if (!trimmed) return '{}';

  const lowered = trimmed.toLowerCase();
  if (
    lowered === 'undefined' ||
    lowered === 'null' ||
    lowered === '"undefined"' ||
    lowered === '"null"'
  ) {
    return '{}';
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isRecord(parsed) || Array.isArray(parsed)) return '{}';
    return JSON.stringify(parsed);
  } catch {
    return '{}';
  }
}
