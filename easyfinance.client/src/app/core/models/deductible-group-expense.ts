export interface DeductibleGroupExpense {
  expenseId?: string | null;
  expenseItemId?: string | null;
  name: string;
  date: string;
  amount: number;
}
