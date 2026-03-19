import type OpenAI from 'openai';
import { AgentCardService } from './index';

export const AGENTCARD_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'agentcard_create_card',
      description: 'Create a virtual Visa card for purchases',
      parameters: {
        type: 'object',
        properties: {
          amountCents: {
            type: 'number',
            description: 'Amount to fund the card with, in cents (e.g., 500 for $5.00)',
          },
          description: {
            type: 'string',
            description: "Optional description of the card's purpose",
          },
        },
        required: ['amountCents'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agentcard_get_funding_status',
      description: 'Check if card funding is complete',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID returned from agentcard_create_card',
          },
        },
        required: ['sessionId'],
      },
    },
  },
];

/**
 * Execute an AgentCard tool call by calling the AgentCard API.
 * Returns a JSON string result suitable for the tool_result message.
 */
export async function executeAgentCardTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    const service = new AgentCardService();

    switch (toolName) {
      case 'agentcard_create_card': {
        const result = await service.createCard({
          amountCents: args.amountCents as number,
          description: args.description as string | undefined,
        });
        return JSON.stringify(result);
      }

      case 'agentcard_get_funding_status': {
        const result = await service.getFundingStatus(args.sessionId as string);
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown AgentCard tool: ${toolName}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AgentCard API call failed';
    return JSON.stringify({ error: msg });
  }
}

/**
 * Check if a tool name belongs to the AgentCard tool set.
 */
export function isAgentCardTool(toolName: string): boolean {
  return AGENTCARD_TOOLS.some(t => t.type === 'function' && t.function.name === toolName);
}
