import { AgentCardAPI } from './api';

export class AgentCardService {
  private api: AgentCardAPI;

  constructor() {
    const apiKey = process.env.AGENTCARD_API_KEY;
    const baseUrl = process.env.AGENTCARD_BASE_URL || 'https://api.agentcard.com';

    if (!apiKey) {
      throw new Error('AGENTCARD_API_KEY environment variable is required');
    }

    this.api = new AgentCardAPI(apiKey, baseUrl);
  }

  /**
   * Create a new virtual card
   * @param params - Card creation parameters
   * @returns Object containing cardId, stripeUrl, and sessionId
   */
  async createCard(params: {
    amountCents: number;
    currency?: string;
    description?: string;
  }): Promise<{ cardId: string; stripeUrl: string; sessionId: string }> {
    try {
      const response = await this.api.createCard(params);
      return {
        cardId: response.cardId,
        stripeUrl: response.stripeUrl,
        sessionId: response.sessionId,
      };
    } catch (error) {
      throw new Error(`Failed to create card: ${error.message}`);
    }
  }

  /**
   * Check if funding is complete
   * @param sessionId - The session ID returned from createCard
   * @returns Object containing status and optionally cardId
   */
  async getFundingStatus(sessionId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    cardId?: string;
  }> {
    try {
      const response = await this.api.getFundingStatus(sessionId);
      return {
        status: response.status,
        cardId: response.cardId,
      };
    } catch (error) {
      throw new Error(`Failed to check funding status: ${error.message}`);
    }
  }

  /**
   * Get card details (only after funded)
   * @param cardId - The ID of the card
   * @returns Object containing card details (decrypted)
   */
  async getCardDetails(cardId: string): Promise<{
    pan: string;
    cvv: string;
    expiry: string;
    cardholderName: string;
  }> {
    try {
      const response = await this.api.getCardDetails(cardId);
      return {
        pan: response.pan,
        cvv: response.cvv,
        expiry: response.expiry,
        cardholderName: response.cardholderName,
      };
    } catch (error) {
      throw new Error(`Failed to get card details: ${error.message}`);
    }
  }

  /**
   * Check remaining balance
   * @param cardId - The ID of the card
   * @returns Object containing balance in cents
   */
  async getBalance(cardId: string): Promise<{ balanceCents: number }> {
    try {
      const response = await this.api.getBalance(cardId);
      return {
        balanceCents: response.balanceCents,
      };
    } catch (error) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }
}

// Internal API client for AgentCard
class AgentCardAPI {
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {}

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AgentCard API error: ${response.status} ${response.statusText} - ${
          errorData.message || 'Unknown error'
        }`
      );
    }

    return response.json();
  }

  async createCard(params: { amountCents: number; currency?: string; description?: string }) {
    return this.fetch<{
      cardId: string;
      stripeUrl: string;
      sessionId: string;
    }>('/cards', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getFundingStatus(sessionId: string) {
    return this.fetch<{
      status: 'pending' | 'completed' | 'failed';
      cardId?: string;
    }>(`/cards/funding-status?sessionId=${encodeURIComponent(sessionId)}`);
  }

  async getCardDetails(cardId: string) {
    return this.fetch<{
      pan: string;
      cvv: string;
      expiry: string;
      cardholderName: string;
    }>(`/cards/${encodeURIComponent(cardId)}`);
  }

  async getBalance(cardId: string) {
    return this.fetch<{ balanceCents: number }>(`/cards/${encodeURIComponent(cardId)}/balance`);
  }
}
