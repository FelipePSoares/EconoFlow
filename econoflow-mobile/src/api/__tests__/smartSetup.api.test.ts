import { getDefaultCategories, postSmartSetup } from '../smartSetup.api';
import { apiClient } from '../client';
import type { SmartSetupRequest } from '../types';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('smartSetup.api', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getDefaultCategories', () => {
    it('GETs the default categories endpoint for a project', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      const result = await getDefaultCategories('proj-1');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/Projects/proj-1/categories/DefaultCategories',
      );
      expect(result.data).toEqual([]);
    });
  });

  describe('postSmartSetup', () => {
    it('POSTs the smart setup payload to the correct endpoint', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: undefined });
      const req: SmartSetupRequest = {
        annualIncome: 60000,
        date: '2026-01-01',
        defaultCategories: [{ id: 'cat-1', name: 'Food', percentage: 100 }],
        emergencyReserveTarget: 5000,
      };
      await postSmartSetup('proj-1', req);
      expect(apiClient.post).toHaveBeenCalledWith('/api/Projects/proj-1/smart-setup/', req);
    });
  });
});
