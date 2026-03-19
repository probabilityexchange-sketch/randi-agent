import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentCardService } from './index';

vi.mock('./index', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  return {
    AgentCardService: vi.fn().mockImplementation(() => ({
      createCard: vi.fn(),
      getFundingStatus: vi.fn(),
      getCardDetails: vi.fn(),
      getBalance: vi.fn(),
    })),
  };
});

describe('AgentCardService', () => {
  beforeEach(() => {
    delete process.env.AGENTCARD_API_KEY;
    delete process.env.AGENTCARD_BASE_URL;
    process.env.AGENTCARD_API_KEY = 'test-api-key';
  });

  describe('createCard', () => {
    it('should create a card and return card details', async () => {
      const mockResponse = {
        cardId: 'card_123',
        stripeUrl: 'https://checkout.stripe.com/pay/cs_123',
        sessionId: 'sess_123',
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const service = new AgentCardService();
      const result = await service.createCard({
        amountCents: 500,
        description: 'Test card',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when API call fails', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'API error' }),
      });
      global.fetch = mockFetch;

      const service = new AgentCardService();
      await expect(service.createCard({ amountCents: 500 })).rejects.toThrow(
        'Failed to create card'
      );
    });
  });

  describe('getFundingStatus', () => {
    it('should return funding status', async () => {
      const mockResponse = {
        status: 'completed',
        cardId: 'card_123',
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const service = new AgentCardService();
      const result = await service.getFundingStatus('sess_123');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCardDetails', () => {
    it('should return card details', async () => {
      const mockResponse = {
        pan: '4242424242424242',
        cvv: '123',
        expiry: '12/25',
        cardholderName: 'Test User',
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const service = new AgentCardService();
      const result = await service.getCardDetails('card_123');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getBalance', () => {
    it('should return balance', async () => {
      const mockResponse = {
        balanceCents: 250,
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const service = new AgentCardService();
      const result = await service.getBalance('card_123');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('constructor', () => {
    it('should throw error when AGENTCARD_API_KEY is missing', () => {
      delete process.env.AGENTCARD_API_KEY;

      expect(() => new AgentCardService()).toThrow(
        'AGENTCARD_API_KEY environment variable is required'
      );
    });
  });
});
