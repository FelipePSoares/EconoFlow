export class PlanEntry {
  id!: string;
  planId!: string;
  date!: Date;
  amountSigned!: number;
  note!: string;
}

export interface PlanEntryRequest {
  date: string;
  amountSigned: number;
  note: string;
}
