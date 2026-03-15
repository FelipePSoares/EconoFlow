import { PlanEntry } from 'src/app/core/models/plan-entry';
import { toLocalDate } from 'src/app/core/utils/date';

export class PlanEntryDto {
  id!: string;
  planId!: string;
  date!: Date;
  amountSigned!: number;
  note!: string;

  static fromPlanEntry(entry: PlanEntry): PlanEntryDto {
    const dto = new PlanEntryDto();
    dto.id = entry.id;
    dto.planId = entry.planId;
    dto.date = toLocalDate(entry.date);
    dto.amountSigned = Number(entry.amountSigned || 0);
    dto.note = entry.note ?? '';
    return dto;
  }

  static fromPlanEntries(entries: PlanEntry[]): PlanEntryDto[] {
    return entries.map(entry => PlanEntryDto.fromPlanEntry(entry));
  }
}
