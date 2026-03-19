import { AgentCardService } from './index';

// Mock the AgentCardAPI class
jest.mock('./api', () => {
  return {
    AgentCardAPI: jest.fn().mockImplementation(() => {
      return {
        createCard: jest.fn(),
        getFundingStatus: jest.fn(),
        getCardDetails: jest.fn(),
        getBalance: jest.fn(),
      };
    }),
  };
});

import { AgentCardAPI } from './api';

describe('AgentCardService', () => {
  let service: AgentCardService;
  let mockApi: jest.Mocked<AgentCardAPI>;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.AGENTCARD_API_KEY;
    delete process.env.AGENTCARD_BASE_URL;

    // Set required environment variable
    process.env.AGENTCARD_API_KEY = 'test-api-key';

    // Create service instance
    service = new AgentCardService();

    // Get mock API instance
    mockApi = (AgentCardAPI as jest.Mock).mock.instances[0];
  });

  describe('createCard', () => {
    it('should create a card and return card details', async () => {
      const mockResponse = {
        cardId: 'card_123',
        stripeUrl: 'https://checkout.stripe.com/pay/cs_123',
        sessionId: 'sess_123',
      };

      mockApi.createCard.mockResolvedValue(mockResponse);

      const result = await service.createCard({
        amountCents: 500,
        description: 'Test card',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.createCard).toHaveBeenCalledWith({
        amountCents: 500,
        description: 'Test card',
      });
    });

    it('should throw error when API call fails', async () => {
      mockApi.createCard.mockRejectedValue(new Error('API error'));

      await expect(service.createCard({ amountCents: 500 })).rejects.toThrow(
        'Failed to create card: API error'
      );
    });
  });

  describe('getFundingStatus', () => {
    it('should return funding status', async () => {
      const mockResponse = {
        status: 'completed',
        cardId: 'card_123',
      };

      mockApi.getFundingStatus.mockResolvedValue(mockResponse);

      const result = await service.getFundingStatus('sess_123');

      expect(result).toEqual(mockResponse);
      expect(mockApi.getFundingStatus).toHaveBeenCalledWith('sess_123');
    });

    it('should throw error when API call fails', async () => {
      mockApi.getFundingStatus.mockRejectedValue(new Error('API error'));

      await expect(service.getFundingStatus('sess_123')).rejects.toThrow(
        'Failed to check funding status: API error'
      );
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

      mockApi.getCardDetails.mockResolvedValue(mockResponse);

      const result = await service.getCardDetails('card_123');

      expect(result).toEqual(mockResponse);
      expect(mockApi.getCardDetails).toHaveBeenCalledWith('card_123');
    });

    it('should throw error when API call fails', async () => {
      mockApi.getCardDetails.mockRejectedValue(new Error('API error'));

      await expect(service.getCardDetails('card_123')).rejects.toThrow(
        'Failed to get card details: API error'
      );
    });
  });

  describe('getBalance', () => {
    it('should return balance', async () => {
      const mockResponse = {
        balanceCents: 250,
      };

      mockApi.getBalance.mockResolvedValue(mockResponse);

      const result = await service.getBalance('card_123');

      expect(result).toEqual(mockResponse);
      expect(mockApi.getBalance).toHaveBeenCalledWith('card_123');
    });

    it('should throw error when API call fails', async () => {
      mockApi.getBalance.mockRejectedValue(new Error('API error'));

      await expect(service.getBalance('card_123')).rejects.toThrow(
        'Failed to get balance: API error'
      );
    });
  });

  describe('constructor', () => {
    it('should throw error when AGENTCARD_API_KEY is missing', () => {
      delete process.env.AGENTCARD_API_KEY;

      expect(() => new AgentCardService()).toThrow(
        'AGENTCARD_API_KEY environment variable is required'
      );
    });

    it('should use default base URL when not provided', () => {
      delete process.env.AGENTCARD_BASE_URL;

      // The constructor should not throw
      expect(() => new AgentCardService()).not.toThrow();

      // Verify the API was instantiated with default base URL
      expect(AgentCardAPI).toHaveBeenCalledWith('test-api-key', 'https://api.agentcard.com');
    });

    it('should use custom base URL when provided', () => {
      process.env.AGENTCARD_BASE_URL = 'https://custom.example.com';

      expect(() => new AgentCardService()).not.toThrow();

      expect(AgentCardAPI).toHaveBeenCalledWith('test-api-key', 'https://custom.example.com');
    });
  });
});
