import type { Category, Expense, Income } from '../api/types';

export const calculateTotalIncome = (incomes: Income[]): number =>
  incomes.reduce((sum, i) => sum + i.amount, 0);

export const calculateTotalExpenses = (categories: Category[]): number =>
  categories.reduce(
    (sum, cat) => sum + cat.expenses.reduce((s, e) => s + e.amount, 0),
    0
  );

export const calculateTotalBudget = (categories: Category[]): number =>
  categories.reduce(
    (sum, cat) => sum + cat.expenses.reduce((s, e) => s + e.budget, 0),
    0
  );

export const calculateExpensesOverspend = (expenses: Expense[]): number =>
  expenses.reduce((s, e) => {
    if (e.budget <= 0) return s;
    const overspend = e.amount - e.budget;
    return s + (overspend > 0 ? overspend : 0);
  }, 0);

export const calculateTotalOverspend = (categories: Category[]): number =>
  categories.reduce(
    (sum, cat) => sum + calculateExpensesOverspend(cat.expenses),
    0
  );

export const calculateRemainingBudget = (categories: Category[]): number => {
  const budget = calculateTotalBudget(categories);
  const expenses = calculateTotalExpenses(categories);
  const overspend = calculateTotalOverspend(categories);
  return Math.max(budget - (expenses - overspend), 0);
};

export const toggleSetItem = (prev: Set<string>, id: string): Set<string> => {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
};
