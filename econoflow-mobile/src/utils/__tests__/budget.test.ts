import { calculateTotalIncome, calculateTotalExpenses, calculateTotalBudget, calculateTotalOverspend, calculateExpensesOverspend, toggleSetItem } from '../budget';
import type { Category, Expense, Income } from '../../api/types';

const makeIncome = (amount: number): Income =>
  ({ id: '1', name: 'i', amount, date: '2024-01-01' } as Income);

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
      items: [],
      attachments: [],
    })),
  } as unknown as Category);

const makeExpense = (amount: number, budget: number): Expense =>
  ({ id: '1', name: 'e', amount, budget, date: '2024-01-01', isDeductible: false, items: [], attachments: [] } as Expense);

describe('calculateExpensesOverspend', () => {
  it('returns 0 when all expenses are within budget', () => {
    expect(calculateExpensesOverspend([makeExpense(50, 100)])).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateExpensesOverspend([])).toBe(0);
  });

  it('counts an unplanned expense (budget=0) as full overspend', () => {
    expect(calculateExpensesOverspend([makeExpense(100, 100), makeExpense(100, 0)])).toBe(100);
  });

  it('does not net underspend against overspend', () => {
    expect(calculateExpensesOverspend([makeExpense(50, 100), makeExpense(100, 0)])).toBe(100);
  });

  it('handles a partially over-budget expense', () => {
    expect(calculateExpensesOverspend([makeExpense(120, 100)])).toBe(20);
  });
});

describe('calculateTotalIncome', () => {
  it('sums all income amounts', () => {
    expect(calculateTotalIncome([makeIncome(100), makeIncome(250)])).toBe(350);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalIncome([])).toBe(0);
  });

  it('handles a single entry', () => {
    expect(calculateTotalIncome([makeIncome(42)])).toBe(42);
  });

  it('handles fractional amounts', () => {
    expect(calculateTotalIncome([makeIncome(10.5), makeIncome(0.5)])).toBeCloseTo(11);
  });
});

describe('calculateTotalExpenses', () => {
  it('sums expense amounts across all categories', () => {
    const cats = [
      makeCategory([{ amount: 50, budget: 100 }, { amount: 30, budget: 80 }]),
      makeCategory([{ amount: 20, budget: 40 }]),
    ];
    expect(calculateTotalExpenses(cats)).toBe(100);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalExpenses([])).toBe(0);
  });

  it('returns 0 for categories with no expenses', () => {
    expect(calculateTotalExpenses([makeCategory([])])).toBe(0);
  });

  it('handles a single category with a single expense', () => {
    expect(calculateTotalExpenses([makeCategory([{ amount: 99, budget: 100 }])])).toBe(99);
  });
});

describe('calculateTotalBudget', () => {
  it('sums budget amounts across all categories', () => {
    const cats = [
      makeCategory([{ amount: 50, budget: 100 }, { amount: 30, budget: 80 }]),
      makeCategory([{ amount: 20, budget: 40 }]),
    ];
    expect(calculateTotalBudget(cats)).toBe(220);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotalBudget([])).toBe(0);
  });

  it('handles zero-budget expenses', () => {
    expect(calculateTotalBudget([makeCategory([{ amount: 50, budget: 0 }])])).toBe(0);
  });
});

describe('calculateTotalOverspend', () => {
  it('returns 0 when all expenses are within budget', () => {
    expect(calculateTotalOverspend([makeCategory([{ amount: 50, budget: 100 }])])).toBe(0);
  });

  it('returns 0 for empty categories', () => {
    expect(calculateTotalOverspend([])).toBe(0);
  });

  it('counts an unplanned expense (budget=0) as full overspend', () => {
    expect(
      calculateTotalOverspend([
        makeCategory([
          { amount: 100, budget: 100 },
          { amount: 100, budget: 0 },
        ]),
      ])
    ).toBe(100);
  });

  it('does not net underspend against overspend across expenses', () => {
    // E1 underspends by 50, E2 overspends by 100 — net would be 50 but correct is 100
    expect(
      calculateTotalOverspend([
        makeCategory([
          { amount: 50, budget: 100 },
          { amount: 100, budget: 0 },
        ]),
      ])
    ).toBe(100);
  });

  it('sums overspend across multiple categories', () => {
    expect(
      calculateTotalOverspend([
        makeCategory([{ amount: 150, budget: 100 }]),
        makeCategory([{ amount: 100, budget: 0 }]),
      ])
    ).toBe(150);
  });

  it('handles partially over-budget expense', () => {
    expect(calculateTotalOverspend([makeCategory([{ amount: 120, budget: 100 }])])).toBe(20);
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

  it('handles toggling on an empty set', () => {
    const result = toggleSetItem(new Set(), 'x');
    expect(result.has('x')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('results in an empty set when the only element is removed', () => {
    const result = toggleSetItem(new Set(['only']), 'only');
    expect(result.size).toBe(0);
  });
});
