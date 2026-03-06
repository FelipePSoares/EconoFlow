export interface DeductibleGroupTotal {
  groupId: string;
  name: string;
  totalAmount: number;
  expenseCount: number;
}

export interface DeductibleGroupTotals {
  taxYearId: string;
  totalAmount: number;
  groups: DeductibleGroupTotal[];
}
