import * as ExpensesApi from '../../api/expenses.api';
import { useAddExpenseItem, usePatchExpense } from '../useExpenses';
import type { CreateExpenseItemRequest } from '../../api/types';

jest.mock('../../api/expenses.api');
jest.mock('../../utils/date', () => ({
  monthStart: () => '2026-06-01',
  monthEnd: () => '2026-06-30',
}));

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  keepPreviousData: undefined,
  useQuery: jest.fn((opts) => ({ data: undefined, isLoading: false, _opts: opts })),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

type MutationOptions = {
  mutationFn: (args: unknown) => Promise<unknown>;
  onSuccess?: () => void;
};

function captureMutationOptions(): MutationOptions {
  const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
  return useMutation.mock.calls[useMutation.mock.calls.length - 1][0] as MutationOptions;
}

beforeEach(() => {
  jest.clearAllMocks();
  (ExpensesApi.patchExpense as jest.Mock).mockResolvedValue({ data: {} });
});

const baseItem: CreateExpenseItemRequest = {
  name: 'Coffee',
  date: '2026-06-15',
  amount: 3.5,
};

describe('useAddExpenseItem (#1058)', () => {
  it('sends isDeductible: true when the item is deductible', async () => {
    useAddExpenseItem('proj-1', 'cat-1', '2026-06');
    const { mutationFn } = captureMutationOptions();

    await mutationFn({
      expenseId: 'exp-1',
      item: { ...baseItem, isDeductible: true },
    });

    expect(ExpensesApi.patchExpense).toHaveBeenCalledWith(
      'proj-1',
      'cat-1',
      'exp-1',
      [
        {
          op: 'add',
          path: '/items/-',
          value: expect.objectContaining({ isDeductible: true }),
        },
      ],
    );
  });

  it('sends isDeductible: false when the item is not deductible', async () => {
    useAddExpenseItem('proj-1', 'cat-1', '2026-06');
    const { mutationFn } = captureMutationOptions();

    await mutationFn({
      expenseId: 'exp-1',
      item: { ...baseItem, isDeductible: false },
    });

    expect(ExpensesApi.patchExpense).toHaveBeenCalledWith(
      'proj-1',
      'cat-1',
      'exp-1',
      [
        {
          op: 'add',
          path: '/items/-',
          value: expect.objectContaining({ isDeductible: false }),
        },
      ],
    );
  });

  it('still copies the item name, date and amount into the patch', async () => {
    useAddExpenseItem('proj-1', 'cat-1', '2026-06');
    const { mutationFn } = captureMutationOptions();

    await mutationFn({
      expenseId: 'exp-1',
      item: { ...baseItem, isDeductible: true },
    });

    const [, , , ops] = (ExpensesApi.patchExpense as jest.Mock).mock.calls[0];
    expect(ops[0].value).toEqual(expect.objectContaining({
      name: 'Coffee',
      date: '2026-06-15',
      amount: 3.5,
      temporaryAttachmentIds: [],
      items: [],
    }));
  });

  it('invalidates the expense and category queries on success', async () => {
    useAddExpenseItem('proj-1', 'cat-1', '2026-06');
    const { onSuccess } = captureMutationOptions();

    onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['expenses', 'proj-1', 'cat-1', '2026-06'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories', 'proj-1', '2026-06'],
    });
  });
});

describe('usePatchExpense – expense item deductible (#1058)', () => {
  it('forwards the item isDeductible replacement to the API unchanged', async () => {
    usePatchExpense('proj-1', 'cat-1', 'exp-1', '2026-06');
    const { mutationFn } = captureMutationOptions();

    const ops = [
      { op: 'replace', path: '/items/0/isDeductible', value: true },
    ] as never;

    await mutationFn(ops);

    expect(ExpensesApi.patchExpense).toHaveBeenCalledWith('proj-1', 'cat-1', 'exp-1', ops);
  });
});
