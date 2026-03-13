import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BudgetBarComponent } from '../../../../core/components/budget-bar/budget-bar.component';
import { ExpenseDto } from '../../../expense/models/expense-dto';
import { IncomeDto } from '../../../income/models/income-dto';
import { MonthlyExpensesChartComponent } from '../../detail-project/monthly-expenses-chart/monthly-expenses-chart.component';

@Component({
  selector: 'app-overview-monthly-chart-card',
  imports: [
    CommonModule,
    TranslateModule,
    BudgetBarComponent,
    MonthlyExpensesChartComponent
  ],
  templateUrl: './overview-monthly-chart-card.component.html',
  styleUrl: './overview-monthly-chart-card.component.css'
})
export class OverviewMonthlyChartCardComponent {
  @Input({ required: true })
  date!: Date;

  @Input()
  language = 'en';

  @Input()
  expenses: ExpenseDto[] = [];

  @Input()
  incomes: IncomeDto[] = [];

  @Input()
  budget = 0;

  @Input()
  spend = 0;

  @Input()
  overspend = 0;

  @Input()
  remaining = 0;

  @Output()
  openRequested = new EventEmitter<void>();
}
