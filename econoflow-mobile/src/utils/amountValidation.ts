/**
 * Returns true when the amount field must be > 0 and the user should see an error.
 *
 * Rules:
 * - Expense with hasItems: amount is derived from child items — never an error.
 * - Editing an existing expense or income: the stored amount (even 0) is valid;
 *   the user should not be blocked from saving without changing the amount.
 * - Editing an expense item: the item carries its own amount — must be > 0.
 * - Creating a new entry: amount must be > 0.
 */
export function shouldShowAmountError(
  hasItems: boolean | undefined,
  editMode: { type: string } | undefined,
  amount: number,
): boolean {
  if (hasItems) return false;
  if (editMode && editMode.type !== 'expenseItem') return false;
  return amount <= 0;
}
