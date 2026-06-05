/**
 * Returns true when the amount field must be > 0 and the user should see an error.
 *
 * Rules (checked in priority order):
 * - Editing an expense item: the item carries its own amount — must be > 0,
 *   regardless of whether the parent expense has hasItems set.
 * - All other cases (creating new entries, editing expenses/incomes): amount is
 *   optional — 0 is a valid value.
 */
export function shouldShowAmountError(
  editMode: { type: string; hasItems?: boolean } | undefined,
  amount: number,
): boolean {
  return editMode?.type === 'expenseItem' && amount <= 0;
}
