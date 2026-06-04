/**
 * Returns true when the amount field must be > 0 and the user should see an error.
 *
 * Rules (checked in priority order):
 * - Editing an expense item: the item carries its own amount — must be > 0,
 *   regardless of whether the parent expense has hasItems set.
 * - Expense with hasItems: amount is derived from child items — never an error.
 * - Editing an existing expense or income: the stored amount (even 0) is valid;
 *   the user should not be blocked from saving without changing the amount.
 * - Creating a new entry: amount must be > 0.
 */
export function shouldShowAmountError(
  editMode: { type: string; hasItems?: boolean } | undefined,
  amount: number,
): boolean {
  if (editMode?.type === 'expenseItem') return amount <= 0;
  if (editMode?.hasItems) return false;
  if (editMode) return false;
  return amount <= 0;
}
