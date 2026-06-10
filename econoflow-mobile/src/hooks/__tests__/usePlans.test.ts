import * as PlansApi from '../../api/plans.api';
import {
  usePlans,
  usePlanEntries,
  useCreatePlan,
  usePatchPlan,
  useArchivePlan,
  useAddPlanEntry,
  useTotalSavedForMonth,
} from '../usePlans';
import type { CreatePlanRequest, CreatePlanEntryRequest, PatchOperation } from '../../api/types';

jest.mock('../../api/plans.api');

const mockInvalidateQueries = jest.fn();

beforeEach(() => {
  mockInvalidateQueries.mockReset();
});

// Capture queries registered via useQueries so useTotalSavedForMonth tests can
// simulate the per-plan entries results. Must be prefixed with "mock" so Jest
// allows the reference inside jest.mock() factories (which are hoisted).
let mockUseQueriesResult: { data?: unknown; isLoading: boolean }[] = [];

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => ({ data: undefined, isLoading: false, _opts: opts })),
  useQueries: jest.fn(() => mockUseQueriesResult),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

describe('usePlans', () => {
  it('passes correct queryKey and enabled flag', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    usePlans('proj-1');
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['plans', 'proj-1'],
        enabled: true,
      }),
    );
  });

  it('queryFn calls getPlans and unwraps data', async () => {
    const mockData = [{ id: 'plan-1', name: 'Vacation' }];
    (PlansApi.getPlans as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });

    usePlans('proj-1');
    const result = await capturedQueryFn();

    expect(PlansApi.getPlans).toHaveBeenCalledWith('proj-1');
    expect(result).toEqual(mockData);
  });
});

describe('usePlanEntries', () => {
  it('passes correct queryKey with planId', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    usePlanEntries('proj-1', 'plan-1');
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['planEntries', 'proj-1', 'plan-1'],
        enabled: true,
      }),
    );
  });

  it('queryFn calls getPlanEntries and unwraps data', async () => {
    const mockData = [{ id: 'e-1', amountSigned: 100 }];
    (PlansApi.getPlanEntries as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });

    usePlanEntries('proj-1', 'plan-1');
    const result = await capturedQueryFn();

    expect(PlansApi.getPlanEntries).toHaveBeenCalledWith('proj-1', 'plan-1');
    expect(result).toEqual(mockData);
  });
});

describe('useCreatePlan', () => {
  it('mutationFn calls createPlan with projectId and data', async () => {
    (PlansApi.createPlan as jest.Mock).mockResolvedValue({ data: {} });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (data: CreatePlanRequest) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useCreatePlan('proj-1');
    const data: CreatePlanRequest = { type: 'Savings', name: 'Test', targetAmount: 500 };
    await capturedMutationFn(data);

    expect(PlansApi.createPlan).toHaveBeenCalledWith('proj-1', data);
  });

  it('onSuccess invalidates plans query for the project', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useCreatePlan('proj-1');
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['plans', 'proj-1'] });
  });
});

describe('usePatchPlan', () => {
  it('mutationFn calls patchPlan with projectId, planId, and ops', async () => {
    (PlansApi.patchPlan as jest.Mock).mockResolvedValue({ data: {} });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (ops: PatchOperation[]) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    usePatchPlan('proj-1', 'plan-1');
    const ops: PatchOperation[] = [{ op: 'replace', path: '/name', value: 'New' }];
    await capturedMutationFn(ops);

    expect(PlansApi.patchPlan).toHaveBeenCalledWith('proj-1', 'plan-1', ops);
  });

  it('onSuccess invalidates plans query for the project', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    usePatchPlan('proj-1', 'plan-1');
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['plans', 'proj-1'] });
  });
});

describe('useArchivePlan', () => {
  it('mutationFn calls archivePlan with projectId and planId', async () => {
    (PlansApi.archivePlan as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (planId: string) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useArchivePlan('proj-1');
    await capturedMutationFn('plan-1');

    expect(PlansApi.archivePlan).toHaveBeenCalledWith('proj-1', 'plan-1');
  });

  it('onSuccess invalidates plans query', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useArchivePlan('proj-1');
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['plans', 'proj-1'] });
  });
});

describe('useAddPlanEntry', () => {
  it('mutationFn calls addPlanEntry with correct args', async () => {
    (PlansApi.addPlanEntry as jest.Mock).mockResolvedValue({ data: {} });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (data: CreatePlanEntryRequest) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useAddPlanEntry('proj-1', 'plan-1');
    const data: CreatePlanEntryRequest = { date: '2026-06-10', amountSigned: 100 };
    await capturedMutationFn(data);

    expect(PlansApi.addPlanEntry).toHaveBeenCalledWith('proj-1', 'plan-1', data);
  });

  it('onSuccess invalidates both entries and plans queries', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useAddPlanEntry('proj-1', 'plan-1');
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['planEntries', 'proj-1', 'plan-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['plans', 'proj-1'],
    });
  });
});

describe('useTotalSavedForMonth', () => {
  const MONTH = '2026-06';

  beforeEach(() => {
    mockUseQueriesResult = [];
  });

  it('returns totalSaved=0 and isLoading=false when there are no plans', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    // usePlans returns empty plan list
    useQuery.mockReturnValueOnce({ data: [], isLoading: false });

    const result = useTotalSavedForMonth('proj-1', MONTH);

    expect(result.totalSaved).toBe(0);
    expect(result.isLoading).toBe(false);
  });

  it('sums entries for the target month across all plans', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    // Two plans
    useQuery.mockReturnValueOnce({
      data: [
        { id: 'p-1', name: 'Vacation' },
        { id: 'p-2', name: 'Emergency' },
      ],
      isLoading: false,
    });
    // Entries for plan-1: two entries in the target month, one outside
    // Entries for plan-2: one entry in the target month
    mockUseQueriesResult = [
      {
        data: [
          { id: 'e-1', date: '2026-06-01', amountSigned: 300 },
          { id: 'e-2', date: '2026-06-15', amountSigned: 200 },
          { id: 'e-3', date: '2026-05-31', amountSigned: 1000 }, // outside month
        ],
        isLoading: false,
      },
      {
        data: [
          { id: 'e-4', date: '2026-06-10', amountSigned: 150 },
        ],
        isLoading: false,
      },
    ];

    const result = useTotalSavedForMonth('proj-1', MONTH);

    // 300 + 200 (plan-1) + 150 (plan-2) = 650; entry from 2026-05 excluded
    expect(result.totalSaved).toBe(650);
    expect(result.isLoading).toBe(false);
  });

  it('includes negative entries (withdrawals) in the total', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useQuery.mockReturnValueOnce({
      data: [{ id: 'p-1', name: 'Savings' }],
      isLoading: false,
    });
    mockUseQueriesResult = [
      {
        data: [
          { id: 'e-1', date: '2026-06-01', amountSigned: 500 },
          { id: 'e-2', date: '2026-06-20', amountSigned: -100 }, // withdrawal
        ],
        isLoading: false,
      },
    ];

    const result = useTotalSavedForMonth('proj-1', MONTH);

    expect(result.totalSaved).toBe(400);
  });

  it('propagates isLoading=true when plans are still loading', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useQuery.mockReturnValueOnce({ data: [], isLoading: true });

    const result = useTotalSavedForMonth('proj-1', MONTH);

    expect(result.isLoading).toBe(true);
  });

  it('propagates isLoading=true when any plan entries query is loading', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useQuery.mockReturnValueOnce({
      data: [{ id: 'p-1', name: 'Savings' }],
      isLoading: false,
    });
    mockUseQueriesResult = [{ data: undefined, isLoading: true }];

    const result = useTotalSavedForMonth('proj-1', MONTH);

    expect(result.isLoading).toBe(true);
  });
});
