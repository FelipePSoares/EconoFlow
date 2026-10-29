/**
 * Returns true when the name field is required.
 *
 * Rules:
 * - Expense items never require a name, whether creating a new item on an
 *   existing expense or editing one (`ExpenseItem.Validate` only caps length).
 * - Expenses and incomes always require a name, on create and on edit.
 */
export function isNameRequired(
  editMode: { type: string } | undefined,
  isAddingItemToExpense: boolean,
): boolean {
  if (editMode?.type === 'expenseItem') return false;
  return !(editMode === undefined && isAddingItemToExpense);
}
