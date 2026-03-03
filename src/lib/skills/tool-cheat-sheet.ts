export const KILO_COMPOSIO_CHEAT_SHEET = `
# Kilo API Gateway Setup
The Kilo AI Gateway is fully OpenAI-compatible. You can use the OpenAI SDK by pointing it to the Kilo base URL.

## Quickstart (Node.js/Vercel AI SDK)
1. Install dependencies: \`npm install ai @ai-sdk/openai dotenv\`
2. Set API Key in .env: \`KILO_API_KEY=your_api_key_here\`
3. Example Code:
\`\`\`javascript
import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import "dotenv/config"

const kilo = createOpenAI({
  baseURL: "https://api.kilo.ai/api/gateway",
  apiKey: process.env.KILO_API_KEY,
})

async function main() {
  const result = streamText({
    model: kilo.chat("anthropic/claude-3.5-sonnet"),
    prompt: "Invent a new holiday and describe its traditions.",
  })
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart)
  }
}
main().catch(console.error)
\`\`\`

# Composio Toolkits Usage
When a user asks you to perform an action (e.g., "Create a GitHub issue"), follow this workflow:
1. Identify Tool: Look through your available functions to find the matching tool (e.g., \`googlecalendar_list_events\`, \`gmail_list_messages\`).
2. Call Directly: Use the standard 'tool_calls' mechanism to execute the specific tool directly. DO NOT use XML tags like <invoke>.
3. Handle Results: Use the data returned to answer the user's request.

# Minimax Format Requirement
If you are a Minimax model (m1.5, m2.5), you MUST output tool calls in the native 'tool_calls' JSON format. 
DO NOT use <invoke> or <parameter> XML tags.
The system ONLY supports the standard function-calling structure.
\`\`\`json
{
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "googlecalendar_list_events",
        "arguments": "{\"calendar_id\": \"primary\"}"
      }
    }
  ]
}
\`\`\`
If you output XML, your request will FAIL.
`;
