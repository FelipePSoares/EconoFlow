import * as SmartSetupApi from '../../api/smartSetup.api';
import { useDefaultCategories, usePostSmartSetup } from '../useSmartSetup';

jest.mock('../../api/smartSetup.api');

const mockInvalidateQueries = jest.fn();

beforeEach(() => {
  mockInvalidateQueries.mockReset();
});

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => ({ data: undefined, isSuccess: false, _opts: opts })),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

describe('useDefaultCategories', () => {
  it('passes correct queryKey and staleTime to useQuery', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useDefaultCategories('proj-1');
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['defaultCategories', 'proj-1'],
        staleTime: 60_000,
      }),
    );
  });

  it('queryFn calls getDefaultCategories and unwraps response data', async () => {
    const mockData = [{ id: 'c1', name: 'Food', percentage: 30 }];
    (SmartSetupApi.getDefaultCategories as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isSuccess: false };
    });

    useDefaultCategories('proj-1');
    const result = await capturedQueryFn();

    expect(SmartSetupApi.getDefaultCategories).toHaveBeenCalledWith('proj-1');
    expect(result).toEqual(mockData);
  });
});

describe('usePostSmartSetup', () => {
  it('mutationFn calls postSmartSetup with projectId and data', async () => {
    (SmartSetupApi.postSmartSetup as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (vars: { projectId: string; data: unknown }) => Promise<unknown>;
    useMutation.mockImplementationOnce(
      (opts: { mutationFn: typeof capturedMutationFn }) => {
        capturedMutationFn = opts.mutationFn;
        return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
      },
    );

    usePostSmartSetup();

    const vars = {
      projectId: 'proj-1',
      data: { annualIncome: 60000, date: '2026-01-01', defaultCategories: [], emergencyReserveTarget: 5000 },
    };
    await capturedMutationFn(vars);

    expect(SmartSetupApi.postSmartSetup).toHaveBeenCalledWith(vars.projectId, vars.data);
  });

  it('onSuccess invalidates categories queries for the project', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: (result: unknown, vars: { projectId: string; data: unknown }) => void;
    useMutation.mockImplementationOnce(
      (opts: { onSuccess: typeof capturedOnSuccess }) => {
        capturedOnSuccess = opts.onSuccess;
        return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
      },
    );

    usePostSmartSetup();

    capturedOnSuccess(undefined, { projectId: 'proj-1', data: {} });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories', 'proj-1'],
    });
  });
});
