import { restoreIncome } from '../incomes.api';
import { restoreExpense, restoreExpenseItem } from '../expenses.api';
import { unarchiveCategory } from '../categories.api';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    put: jest.fn(),
  },
}));

const mockPut = apiClient.put as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockResolvedValue({ data: undefined, status: 204 });
});

describe('restoreIncome', () => {
  it('calls PUT on the restore endpoint', () => {
    restoreIncome('proj-1', 'income-1');
    expect(mockPut).toHaveBeenCalledWith('/api/Projects/proj-1/Incomes/income-1/restore');
  });
});

describe('restoreExpense', () => {
  it('calls PUT on the restore endpoint', () => {
    restoreExpense('proj-1', 'cat-1', 'exp-1');
    expect(mockPut).toHaveBeenCalledWith(
      '/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1/restore'
    );
  });
});

describe('restoreExpenseItem', () => {
  it('calls PUT on the restore endpoint', () => {
    restoreExpenseItem('proj-1', 'cat-1', 'exp-1', 'item-1');
    expect(mockPut).toHaveBeenCalledWith(
      '/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1/ExpenseItems/item-1/restore'
    );
  });
});

describe('unarchiveCategory', () => {
  it('calls PUT on the unarchive endpoint', () => {
    unarchiveCategory('proj-1', 'cat-1');
    expect(mockPut).toHaveBeenCalledWith('/api/Projects/proj-1/Categories/cat-1/Unarchive');
  });
});
