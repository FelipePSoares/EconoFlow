import * as AttachmentsApi from '../../api/attachments.api';
import * as ExpensesApi from '../../api/expenses.api';
import * as IncomesApi from '../../api/incomes.api';
import {
  useIncome,
  useExpense,
  useAddIncomeAttachment,
  useDeleteIncomeAttachment,
  useAddExpenseAttachment,
  useDeleteExpenseAttachment,
} from '../useAttachments';
import type { UploadFile } from '../../api/attachments.api';

jest.mock('../../api/attachments.api');
jest.mock('../../api/expenses.api');
jest.mock('../../api/incomes.api');

const mockInvalidateQueries = jest.fn();

beforeEach(() => {
  mockInvalidateQueries.mockReset();
});

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => ({ data: undefined, isLoading: false, _opts: opts })),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

const file: UploadFile = { uri: 'file:///tmp/payslip.pdf', name: 'payslip.pdf', type: 'application/pdf' };

describe('useIncome', () => {
  it('uses the income query key and loads the record by id', async () => {
    const mockData = { id: 'inc-1', name: 'Salary', attachments: [] };
    (IncomesApi.getIncome as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });

    useIncome('proj-1', 'inc-1');

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['income', 'proj-1', 'inc-1'],
        enabled: true,
      }),
    );

    await expect(capturedQueryFn()).resolves.toEqual(mockData);
    expect(IncomesApi.getIncome).toHaveBeenCalledWith('proj-1', 'inc-1');
  });

  it('is disabled without an income id', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useQuery.mockClear();

    useIncome('proj-1', '');

    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
});

describe('useExpense', () => {
  it('uses the expense query key and loads the record by id', async () => {
    const mockData = { id: 'exp-1', name: 'Rent', attachments: [] };
    (ExpensesApi.getExpense as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });

    useExpense('proj-1', 'cat-1', 'exp-1');

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['expense', 'proj-1', 'cat-1', 'exp-1'],
        enabled: true,
      }),
    );

    await expect(capturedQueryFn()).resolves.toEqual(mockData);
    expect(ExpensesApi.getExpense).toHaveBeenCalledWith('proj-1', 'cat-1', 'exp-1');
  });
});

describe('useAddIncomeAttachment', () => {
  it('uploads the file through the income attachment endpoint', async () => {
    (AttachmentsApi.uploadIncomeAttachment as jest.Mock).mockResolvedValue({ data: { id: 'att-1' } });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (file: UploadFile) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useAddIncomeAttachment('proj-1', 'inc-1', '2026-03');

    await expect(capturedMutationFn(file)).resolves.toEqual({ id: 'att-1' });
    expect(AttachmentsApi.uploadIncomeAttachment).toHaveBeenCalledWith('proj-1', 'inc-1', file);
  });

  it('invalidates the income record and the income list on success', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useAddIncomeAttachment('proj-1', 'inc-1', '2026-03');
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['income', 'proj-1', 'inc-1'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['incomes', 'proj-1', '2026-03'] });
  });
});

describe('useDeleteIncomeAttachment', () => {
  it('deletes the attachment and invalidates both queries', async () => {
    (AttachmentsApi.deleteIncomeAttachment as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (attachmentId: string) => Promise<unknown>;
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: {
      mutationFn: typeof capturedMutationFn;
      onSuccess: typeof capturedOnSuccess;
    }) => {
      capturedMutationFn = opts.mutationFn;
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useDeleteIncomeAttachment('proj-1', 'inc-1', '2026-03');

    await capturedMutationFn('att-1');
    expect(AttachmentsApi.deleteIncomeAttachment).toHaveBeenCalledWith('proj-1', 'inc-1', 'att-1');

    capturedOnSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['income', 'proj-1', 'inc-1'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['incomes', 'proj-1', '2026-03'] });
  });
});

describe('useAddExpenseAttachment', () => {
  it('uploads the deductible proof and refreshes the expense, list and category queries', async () => {
    (AttachmentsApi.uploadExpenseAttachment as jest.Mock).mockResolvedValue({ data: { id: 'att-1' } });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (file: UploadFile) => Promise<unknown>;
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: {
      mutationFn: typeof capturedMutationFn;
      onSuccess: typeof capturedOnSuccess;
    }) => {
      capturedMutationFn = opts.mutationFn;
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useAddExpenseAttachment('proj-1', 'cat-1', 'exp-1', '2026-03');

    await capturedMutationFn(file);
    expect(AttachmentsApi.uploadExpenseAttachment).toHaveBeenCalledWith('proj-1', 'cat-1', 'exp-1', file);

    capturedOnSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['expense', 'proj-1', 'cat-1', 'exp-1'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['expenses', 'proj-1', 'cat-1', '2026-03'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['categories', 'proj-1', '2026-03'] });
  });
});

describe('useDeleteExpenseAttachment', () => {
  it('deletes the attachment and refreshes the affected queries', async () => {
    (AttachmentsApi.deleteExpenseAttachment as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (attachmentId: string) => Promise<unknown>;
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: {
      mutationFn: typeof capturedMutationFn;
      onSuccess: typeof capturedOnSuccess;
    }) => {
      capturedMutationFn = opts.mutationFn;
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useDeleteExpenseAttachment('proj-1', 'cat-1', 'exp-1', '2026-03');

    await capturedMutationFn('att-1');
    expect(AttachmentsApi.deleteExpenseAttachment).toHaveBeenCalledWith('proj-1', 'cat-1', 'exp-1', 'att-1');

    capturedOnSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['expense', 'proj-1', 'cat-1', 'exp-1'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['expenses', 'proj-1', 'cat-1', '2026-03'] });
  });
});
