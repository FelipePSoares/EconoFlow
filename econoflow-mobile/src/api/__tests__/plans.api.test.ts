import { createPlan, archivePlan, addPlanEntry } from '../plans.api';
import { apiClient } from '../client';
import type { CreatePlanRequest, CreatePlanEntryRequest } from '../types';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('plans.api — mutations', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createPlan', () => {
    it('POSTs to /api/Projects/{projectId}/Plans with payload', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      const req: CreatePlanRequest = { type: 'Savings', name: 'Vacation', targetAmount: 1000 };
      await createPlan('proj-1', req);
      expect(apiClient.post).toHaveBeenCalledWith('/api/Projects/proj-1/Plans', req);
    });

    it('POSTs EmergencyReserve type plan', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      const req: CreatePlanRequest = { type: 'EmergencyReserve', name: 'Emergency', targetAmount: 5000 };
      await createPlan('proj-1', req);
      expect(apiClient.post).toHaveBeenCalledWith('/api/Projects/proj-1/Plans', req);
    });
  });

  describe('archivePlan', () => {
    it('PUTs to /api/Projects/{projectId}/Plans/{planId}/archive', async () => {
      (apiClient.put as jest.Mock).mockResolvedValue({ data: undefined });
      await archivePlan('proj-1', 'plan-1');
      expect(apiClient.put).toHaveBeenCalledWith('/api/Projects/proj-1/Plans/plan-1/archive');
    });
  });

  describe('addPlanEntry', () => {
    it('POSTs deposit entry to /api/Projects/{projectId}/Plans/{planId}/entries', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      const req: CreatePlanEntryRequest = { date: '2026-06-10', amountSigned: 500, note: 'First deposit' };
      await addPlanEntry('proj-1', 'plan-1', req);
      expect(apiClient.post).toHaveBeenCalledWith('/api/Projects/proj-1/Plans/plan-1/entries', req);
    });

    it('POSTs withdrawal entry with negative amountSigned', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      const req: CreatePlanEntryRequest = { date: '2026-06-10', amountSigned: -200 };
      await addPlanEntry('proj-1', 'plan-1', req);
      expect(apiClient.post).toHaveBeenCalledWith('/api/Projects/proj-1/Plans/plan-1/entries', req);
    });
  });
});
