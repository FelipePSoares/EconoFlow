import { getIncome } from '../incomes.api';
import { getExpense } from '../expenses.api';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ data: {}, status: 200 });
});

describe('getIncome', () => {
  it('gets a single income by id within the project', async () => {
    const income = { id: 'inc-1', name: 'Salary', attachments: [] };
    mockGet.mockResolvedValue({ data: income, status: 200 });

    const response = await getIncome('proj-1', 'inc-1');

    expect(mockGet).toHaveBeenCalledWith('/api/Projects/proj-1/Incomes/inc-1');
    expect(response.data).toEqual(income);
  });
});

describe('getExpense', () => {
  it('gets a single expense by id within the category', async () => {
    const expense = { id: 'exp-1', name: 'Lunch', attachments: [] };
    mockGet.mockResolvedValue({ data: expense, status: 200 });

    const response = await getExpense('proj-1', 'cat-1', 'exp-1');

    expect(mockGet).toHaveBeenCalledWith(
      '/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1'
    );
    expect(response.data).toEqual(expense);
  });
});
