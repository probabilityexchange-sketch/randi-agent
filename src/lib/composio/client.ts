import type { Composio as ComposioClient } from "@composio/core";
import type OpenAI from "openai";

const apiKey = process.env.COMPOSIO_API_KEY?.trim() || "";
const globalForComposio = globalThis as unknown as {
  composioClientPromise?: Promise<ComposioClient | null>;
};
let loggedMissingComposioApiKey = false;

export async function getComposioClient(): Promise<ComposioClient | null> {
  if (!apiKey) {
    if (!loggedMissingComposioApiKey) {
      console.warn("COMPOSIO_API_KEY is not set in environment variables");
      loggedMissingComposioApiKey = true;
    }
    return null;
  }

  if (!globalForComposio.composioClientPromise) {
    globalForComposio.composioClientPromise = (async () => {
      try {
        const { Composio } = await import("@composio/core");
        return new Composio({ apiKey }) as ComposioClient;
      } catch (error) {
        console.error("Failed to initialize Composio client", error);
        return null;
      }
    })();
  }

  return globalForComposio.composioClientPromise;
}

type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool;
type OpenAIToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

const MAX_TOOL_DEFINITIONS = 50;
const TOOL_SLUG_PATTERN = /^[A-Z0-9_]+$/;
const TOOLKIT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const LEGACY_TOOLKIT_ALIASES: Record<string, string> = {
  github_api: "github",
  slack_api: "slack",
  notion_api: "notion",
  google_calendar: "googlecalendar",
  google_sheets: "googlesheets",
  prompmate_api: "prompmate",
  promptmate_api: "prompmate",
  promptmate: "prompmate",
  coinmarketcap_api: "coinmarketcap",
  cmc_api: "coinmarketcap",
  cmc: "coinmarketcap",
  supabase_api: "supabase",
  vercel_api: "vercel",
  telegram_api: "telegram",
};

interface ParsedAgentToolConfig {
  explicitTools: string[];
  toolkitHints: string[];
  fallbackTools: string[];
}

export function resolveComposioUserId(userId: string): string {
  const override = process.env.COMPOSIO_ENTITY_ID?.trim();
  if (override) return override;
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    throw new Error("Missing authenticated user id for Composio user mapping");
  }
  return normalizedUserId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeToolkitHint(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const mapped = LEGACY_TOOLKIT_ALIASES[normalized] ?? normalized;
  return TOOLKIT_SLUG_PATTERN.test(mapped) ? mapped : null;
}

function parseAgentToolConfig(
  rawConfig: string | null | undefined
): ParsedAgentToolConfig {
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
    const explicitTools = values.filter((value) => TOOL_SLUG_PATTERN.test(value));
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

function isOpenAITool(value: unknown): value is OpenAITool {
  if (!isRecord(value) || value.type !== "function") return false;
  const fn = value.function;
  return isRecord(fn) && typeof fn.name === "string";
}

function toOpenAITools(value: unknown): OpenAITool[] {
  if (Array.isArray(value)) {
    return value.filter(isOpenAITool);
  }

  return isOpenAITool(value) ? [value] : [];
}

function dedupeTools(tools: OpenAITool[]): OpenAITool[] {
  const seen = new Set<string>();
  const deduped: OpenAITool[] = [];

  for (const tool of tools) {
    if (tool.type !== "function") continue;
    const key = tool.function.name;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tool);
  }

  return deduped;
}

type ComposioToolQuery =
  | { kind: "tools"; tools: string[] }
  | { kind: "toolkits"; toolkits: string[] };

async function fetchToolsByQuery(
  composioClient: ComposioClient,
  userId: string,
  query: ComposioToolQuery
): Promise<OpenAITool[]> {
  try {
    const tools = query.kind === "tools"
      ? await composioClient.tools.get(userId, { tools: query.tools })
      : await composioClient.tools.get(userId, {
        toolkits: query.toolkits,
        limit: MAX_TOOL_DEFINITIONS,
      });
    return toOpenAITools(tools);
  } catch (error) {
    console.warn("[Composio] Tool query failed:", query, error);
    return [];
  }
}

async function fetchToolBySlug(
  composioClient: ComposioClient,
  userId: string,
  slug: string
): Promise<OpenAITool | null> {
  try {
    const tool = await composioClient.tools.get(userId, slug);
    const wrappedTools = toOpenAITools(tool);
    return wrappedTools[0] ?? null;
  } catch {
    return null;
  }
}

export async function getAgentToolsFromConfig(
  rawConfig: string | null | undefined,
  userId: string
): Promise<OpenAITool[]> {
  const composioClient = await getComposioClient();
  if (!composioClient) return [];
  const resolvedUserId = resolveComposioUserId(userId);

  const parsed = parseAgentToolConfig(rawConfig);
  if (
    parsed.explicitTools.length === 0 &&
    parsed.toolkitHints.length === 0 &&
    parsed.fallbackTools.length === 0
  ) {
    return [];
  }

  const collectedTools: OpenAITool[] = [];

  if (parsed.explicitTools.length > 0) {
    collectedTools.push(
      ...(await fetchToolsByQuery(composioClient, resolvedUserId, {
        kind: "tools",
        tools: parsed.explicitTools,
      }))
    );
  }

  if (parsed.toolkitHints.length > 0) {
    // Fetch each toolkit SEPARATELY to prevent large toolkits (GitHub=40+)
    // from crowding out smaller ones (Gmail=5, Calendar=5)
    const PER_TOOLKIT_LIMIT = 10;
    const toolkitResults = await Promise.all(
      parsed.toolkitHints.map(toolkit =>
        fetchToolsByQuery(composioClient, resolvedUserId, {
          kind: "toolkits",
          toolkits: [toolkit],
        }).then(tools => {
          console.log(`[Composio] Toolkit "${toolkit}" returned ${tools.length} tools`);
          return tools.slice(0, PER_TOOLKIT_LIMIT);
        })
      )
    );
    for (const tools of toolkitResults) {
      collectedTools.push(...tools);
    }
  }

  if (collectedTools.length === 0) {
    for (const fallbackTool of parsed.fallbackTools) {
      const tool = await fetchToolBySlug(
        composioClient,
        resolvedUserId,
        fallbackTool
      );
      if (tool) collectedTools.push(tool);
    }
  }

  const finalTools = dedupeTools(collectedTools);
  console.log(`[Composio] Collected ${finalTools.length} tools for user ${resolvedUserId}`);
  if (finalTools.length > 0) {
    const prefixes = new Set(
      finalTools
        .filter((t): t is any => t.type === 'function')
        .map(t => t.function.name.split('_')[0])
    );
    console.log(`[Composio] Tools found for prefixes: ${Array.from(prefixes).join(', ')}`);
  }
  return finalTools;
}

export async function executeOpenAIToolCall(
  userId: string,
  toolCall: OpenAIToolCall,
  runtimeUrl?: string
): Promise<string> {
  const composioClient = await getComposioClient();
  if (!composioClient) {
    return JSON.stringify({ error: "COMPOSIO_API_KEY is not configured." });
  }
  const resolvedUserId = resolveComposioUserId(userId);
  if (toolCall.type !== "function") {
    return JSON.stringify({ error: "Only function tool calls are supported." });
  }
  const normalizedToolCall = normalizeToolCallArguments(toolCall);

  // ── DEDICATED RUNTIME ROUTING ──────────────────────────────────────────
  // If a dedicated runtime URL is provided, we route the tool call there.
  // This ensures the agent's actions happen within the user's isolated box.
  if (runtimeUrl) {
    try {
      const endpoint = new URL("/api/tools/execute", runtimeUrl).toString();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resolvedUserId,
          toolCall: normalizedToolCall,
        }),
      });

      if (response.ok) {
        return await response.text();
      }

      // If dedicated execution fails, we log it and continue.
      // In a real scenario, you might want a fallback to shared here, 
      // but for now we follow the explicit target.
      const errorText = await response.text();
      console.warn(`Dedicated tool execution failed at ${runtimeUrl}:`, errorText);
    } catch (error) {
      console.error(`Failed to reach dedicated runtime at ${runtimeUrl}:`, error);
    }
  }

  // Fallback to Shared Composio execution
  try {
    return await composioClient.provider.executeToolCall(
      resolvedUserId,
      normalizedToolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool execution failed";
    return JSON.stringify({
      error: message,
      tool: toolCall.function.name,
    });
  }
}

function normalizeToolCallArguments(toolCall: OpenAIToolCall): OpenAIToolCall {
  if (toolCall.type !== "function") return toolCall;

  const normalizedArguments = normalizeToolCallArgumentsJson(
    toolCall.function.arguments
  );

  if (normalizedArguments === toolCall.function.arguments) return toolCall;

  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: normalizedArguments,
    },
  };
}

function normalizeToolCallArgumentsJson(rawArgs: unknown): string {
  if (typeof rawArgs !== "string") return "{}";

  const trimmed = rawArgs.trim();
  if (!trimmed) return "{}";

  const lowered = trimmed.toLowerCase();
  if (
    lowered === "undefined" ||
    lowered === "null" ||
    lowered === "\"undefined\"" ||
    lowered === "\"null\""
  ) {
    return "{}";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isRecord(parsed) || Array.isArray(parsed)) return "{}";
    return JSON.stringify(parsed);
  } catch {
    return "{}";
  }
}
