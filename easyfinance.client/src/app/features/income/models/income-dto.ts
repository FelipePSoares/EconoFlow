import { Income } from "src/app/core/models/income";
import { Attachment } from "src/app/core/models/attachment";
import { toLocalDate } from "src/app/core/utils/date";

export class IncomeDto {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  attachments!: Attachment[];
  temporaryAttachmentIds!: string[];

  static fromIncome(income: Income): IncomeDto {
    const dto = new IncomeDto();
    dto.id = income.id;
    dto.name = income.name;
    dto.date = toLocalDate(income.date);
    dto.amount = income.amount;
    dto.attachments = income.attachments ?? [];
    dto.temporaryAttachmentIds = income.temporaryAttachmentIds ?? [];
    return dto;
  }

  static fromIncomes(incomes: Income[]): IncomeDto[] {
    return incomes.map(income => IncomeDto.fromIncome(income));
  }
}
