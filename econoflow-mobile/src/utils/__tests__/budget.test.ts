import { calculateTotalIncome, calculateTotalExpenses, calculateTotalBudget, calculateTotalOverspend, calculateExpensesOverspend, calculateRemainingBudget, toggleSetItem } from '../budget';
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

  it('does not count an unplanned expense (budget=0) as overspend', () => {
    expect(calculateExpensesOverspend([makeExpense(100, 100), makeExpense(100, 0)])).toBe(0);
  });

  it('does not count an unplanned expense alongside an under-budget expense', () => {
    expect(calculateExpensesOverspend([makeExpense(50, 100), makeExpense(100, 0)])).toBe(0);
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

  it('does not count an unplanned expense (budget=0) as overspend', () => {
    expect(
      calculateTotalOverspend([
        makeCategory([
          { amount: 100, budget: 100 },
          { amount: 100, budget: 0 },
        ]),
      ])
    ).toBe(0);
  });

  it('does not net unplanned expense against under-budget expense', () => {
    expect(
      calculateTotalOverspend([
        makeCategory([
          { amount: 50, budget: 100 },
          { amount: 100, budget: 0 },
        ]),
      ])
    ).toBe(0);
  });

  it('sums overspend across categories, ignoring unplanned expenses', () => {
    expect(
      calculateTotalOverspend([
        makeCategory([{ amount: 150, budget: 100 }]),
        makeCategory([{ amount: 100, budget: 0 }]),
      ])
    ).toBe(50);
  });

  it('handles partially over-budget expense', () => {
    expect(calculateTotalOverspend([makeCategory([{ amount: 120, budget: 100 }])])).toBe(20);
  });
});

describe('calculateRemainingBudget', () => {
  it('returns full budget when nothing is spent', () => {
    expect(calculateRemainingBudget([makeCategory([{ amount: 0, budget: 100 }])])).toBe(100);
  });

  it('returns 0 when budget is exactly spent', () => {
    expect(calculateRemainingBudget([makeCategory([{ amount: 100, budget: 100 }])])).toBe(0);
  });

  it('sums remaining across multiple under-budget categories', () => {
    const cats = [
      makeCategory([{ amount: 50, budget: 100 }]),
      makeCategory([{ amount: 20, budget: 80 }]),
    ];
    // budget=180, expenses=70, overspend=0 → remaining = 110
    expect(calculateRemainingBudget(cats)).toBe(110);
  });

  it('does not let overspend from one category reduce the remaining of another', () => {
    const cats = [
      makeCategory([{ amount: 50, budget: 100 }]),  // 50 remaining
      makeCategory([{ amount: 150, budget: 100 }]), // 50 over
    ];
    // budget=200, expenses=200, overspend=50 → remaining = max(200-(200-50),0) = 50
    expect(calculateRemainingBudget(cats)).toBe(50);
  });

  it('returns 0 when over budget with no under-budget slack', () => {
    expect(calculateRemainingBudget([makeCategory([{ amount: 150, budget: 100 }])])).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(calculateRemainingBudget([])).toBe(0);
  });

  it('unplanned expenses consume remaining budget but are not counted as overspend', () => {
    // planned: amount=80, budget=100 → 20 remaining
    // unplanned: amount=100, budget=0 → consumes budget but not "over"
    // budget=100, expenses=180, overspend=0 → remaining = max(100-180, 0) = 0
    const cats = [
      makeCategory([{ amount: 80, budget: 100 }]),
      makeCategory([{ amount: 100, budget: 0 }]),
    ];
    expect(calculateRemainingBudget(cats)).toBe(0);
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
