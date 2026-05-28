import { calculateTotalIncome, calculateTotalExpenses, calculateTotalBudget, toggleSetItem } from '../budget';
import type { Category, Income } from '../../api/types';

const makeIncome = (amount: number): Income =>
  ({ id: '1', name: 'i', amount, date: '2024-01-01', isDeductible: false } as Income);

const makeCategory = (expenses: { amount: number; budget: number }[]): Category =>
  ({
    id: '1',
    name: 'cat',
    expenses: expenses.map((e, i) => ({
      id: String(i),
      name: 'e',
      amount: e.amount,
      budget: e.budget,
      date: '2024-01-01',
      isDeductible: false,
      expenseItems: [],
    })),
  } as unknown as Category);

describe('calculateTotalIncome', () => {
  it('sums all income amounts', () => {
    expect(calculateTotalIncome([makeIncome(100), makeIncome(250)])).toBe(350);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalIncome([])).toBe(0);
  });
});

describe('calculateTotalExpenses', () => {
  it('sums expense amounts across all categories', () => {
    const cats = [makeCategory([{ amount: 50, budget: 100 }, { amount: 30, budget: 80 }]), makeCategory([{ amount: 20, budget: 40 }])];
    expect(calculateTotalExpenses(cats)).toBe(100);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalExpenses([])).toBe(0);
  });

  it('returns 0 for categories with no expenses', () => {
    expect(calculateTotalExpenses([makeCategory([])])).toBe(0);
  });
});

describe('calculateTotalBudget', () => {
  it('sums budget amounts across all categories', () => {
    const cats = [makeCategory([{ amount: 50, budget: 100 }, { amount: 30, budget: 80 }]), makeCategory([{ amount: 20, budget: 40 }])];
    expect(calculateTotalBudget(cats)).toBe(220);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalBudget([])).toBe(0);
  });
});

describe('toggleSetItem', () => {
  it('adds an id that is not in the set', () => {
    const result = toggleSetItem(new Set(['a', 'b']), 'c');
    expect(result.has('c')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('removes an id that is already in the set', () => {
    const result = toggleSetItem(new Set(['a', 'b']), 'a');
    expect(result.has('a')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('does not mutate the original set', () => {
    const original = new Set(['a']);
    toggleSetItem(original, 'b');
    expect(original.size).toBe(1);
  });
});
