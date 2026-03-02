import OpenAI from "openai";

const kiloKey = process.env.KILO_API_KEY?.trim();
const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
const apiKey = kiloKey || openRouterKey || "sk-no-key-set";

console.log(`[AI] Initializing gateway client using ${kiloKey ? "Kilo AI" : "OpenRouter"}`);
if (apiKey !== "sk-no-key-set") {
    console.log(`[AI] Using API Key starting with: ${apiKey.substring(0, 7)}...`);
} else {
    console.warn("[AI] No API key found in environment variables!");
}

export const openrouter = new OpenAI({
    baseURL: kiloKey ? "https://api.kilo.ai/api/gateway" : "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Randi Agent Platform",
        "X-OpenRouter-Retries": "3",
    },
    maxRetries: 3,
});

export const DEFAULT_MODEL =
    process.env.KILO_DEFAULT_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

export function isUnmeteredModel(modelId: string): boolean {
    return modelId.endsWith(":free") || modelId.includes("/free");
}

export async function createChatCompletion(options: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming) {
    let lastError: any;

    // Sanitize model ID for Kilo: some gateways don't like the OpenRouter ':free' suffix
    const isKilo = !!process.env.KILO_API_KEY;
    const sanitizedModel = isKilo ? options.model.replace(":free", "") : options.model;

    console.log(`[AI] Requesting completion with model: ${sanitizedModel} (original: ${options.model})`);

    const requestOptions: any = {
        ...options,
        model: sanitizedModel
    };

    // Strip empty tools to prevent hallucinations on model gateways
    if (Array.isArray(requestOptions.tools) && requestOptions.tools.length === 0) {
        delete requestOptions.tools;
        delete requestOptions.tool_choice;
    }

    for (let i = 0; i < 3; i++) {
        try {
            const response = await openrouter.chat.completions.create(requestOptions);

            // --- MINIMAX TOOL CALL PARSER ---
            // Minimax sometimes returns tool calls as raw XML in the content rather than native tool_calls
            const msg = response.choices?.[0]?.message;
            if (msg && typeof msg.content === 'string' && msg.content.includes('<invoke name=')) {
                console.log("[AI] Detected Minimax XML tool call in content, parsing...");

                const invokeRegex = /<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/g;
                const paramRegex = /<parameter name="([^"]+)">([\s\S]*?)<\/parameter>/g;

                let match;
                const tool_calls = [];
                let newContent = msg.content;

                while ((match = invokeRegex.exec(msg.content)) !== null) {
                    const toolName = match[1];
                    const paramsBlock = match[2];

                    const args: Record<string, any> = {};
                    let paramMatch;
                    while ((paramMatch = paramRegex.exec(paramsBlock)) !== null) {
                        try {
                            // Try parsing as JSON in case it's a nested object string, otherwise take raw string
                            args[paramMatch[1]] = JSON.parse(paramMatch[2]);
                        } catch {
                            args[paramMatch[1]] = paramMatch[2].trim();
                        }
                    }

                    tool_calls.push({
                        id: `call_${Math.random().toString(36).substring(2, 9)}`,
                        type: 'function' as const,
                        function: {
                            name: toolName,
                            arguments: JSON.stringify(args)
                        }
                    });

                    // Remove the XML block from the content
                    newContent = newContent.replace(match[0], '').trim();
                }

                if (tool_calls.length > 0) {
                    msg.tool_calls = msg.tool_calls ? [...msg.tool_calls, ...tool_calls] : tool_calls;
                    msg.content = newContent === '' ? null : newContent;
                }
            }

            return response;
        } catch (error: any) {
            const status = error.status || error.statusCode;
            if (status === 503 || status === 429 || status === 502 || status === 504) {
                const wait = Math.pow(2, i) * 1000;
                await new Promise((r) => setTimeout(r, wait));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
