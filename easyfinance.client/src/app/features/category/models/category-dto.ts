import { ExpenseDto } from "../../expense/models/expense-dto";
import { CategoryStatus } from "../../../core/enums/categoryStatus";
import { Category } from "src/app/core/models/category";

export class CategoryDto {
  id!: string;
  name!: string;
  expenses!: ExpenseDto[];
  isArchived!: boolean;

  static fromCategory(category: Category): CategoryDto {
    const dto = new CategoryDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.expenses = category.expenses.map(expense => ExpenseDto.fromExpense(expense));
    dto.isArchived = category.isArchived;
    return dto;
  }

  static fromCategories(categories: Category[]): CategoryDto[] {
    return categories.map(cat => CategoryDto.fromCategory(cat));
  }

  hasBudget(): boolean { return this.getStatus() != CategoryStatus.NotDefined; }
  hasOverspend(): boolean { return this.getStatus() == CategoryStatus.Exceeded; }
  hasRisk(): boolean { return this.getStatus() == CategoryStatus.Risk; }

  public getStatus(): CategoryStatus {
    let percentage = this.getPercentageSpend();

    if (percentage == undefined) {
      return CategoryStatus.NotDefined;
    }else if(percentage <= this.getCurrPercentageOfMonth()){
      return CategoryStatus.Normal;
    }else if(percentage <= 100 && percentage > this.getCurrPercentageOfMonth()){
      return CategoryStatus.Risk;
    }
    return  CategoryStatus.Exceeded;
  }

  public getTotalSpend(): number {
    return (this.expenses?.reduce((sum, current) => sum + current.getSpend(), 0) ?? 0);
  }

  public getTotalBudget(): number {
    return this.expenses?.reduce((sum, current) => sum + current.budget, 0) ?? 0;
  }

  public getTotalOverspend(): number {
    return this.expenses?.reduce((sum, current) => sum + current.getOverspend(), 0) ?? 0;
  }

  public getTotalRemaining(): number {
    return this.expenses?.reduce((sum, current) => sum + current.getRemaining(), 0) ?? 0;
  }

  public getPercentageSpend(): number | undefined {
    return this.getTotalBudget() == 0 ? undefined : (this.getTotalSpend() + this.getTotalOverspend()) * 100 / this.getTotalBudget();
  }
  public getCurrPercentageOfMonth():number{
    var today = new Date();
    return today ? (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100 : 0;
  }
}
