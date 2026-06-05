/**
 * Returns true when the name field is required.
 *
 * Rules:
 * - Creating a new item added to an existing expense: name is optional.
 * - All other cases (creating expenses/incomes, editing any entry): name is required.
 */
export function isNameRequired(
  editMode: { type: string } | undefined,
  isAddingItemToExpense: boolean,
): boolean {
  return !(editMode === undefined && isAddingItemToExpense);
}
