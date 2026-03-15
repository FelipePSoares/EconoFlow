import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BudgetBarComponent } from '../../../../core/components/budget-bar/budget-bar.component';
import { AnnualIncomeExpenseChartComponent } from '../../detail-project/annual-income-expense-chart/annual-income-expense-chart.component';

@Component({
  selector: 'app-overview-annual-chart-card',
  imports: [
    CommonModule,
    TranslateModule,
    BudgetBarComponent,
    AnnualIncomeExpenseChartComponent
  ],
  templateUrl: './overview-annual-chart-card.component.html',
  styleUrl: './overview-annual-chart-card.component.css'
})
export class OverviewAnnualChartCardComponent {
  @Input({ required: true })
  date!: Date;

  @Input()
  chartData: ChartData<'bar'> = this.createEmptyChartData();

  @Input()
  chartOptions: ChartOptions<'bar'> = {};

  @Input()
  yearBudget = 0;

  @Input()
  yearSpend = 0;

  @Input()
  yearOverspend = 0;

  @Input()
  yearRemaining = 0;

  @Output()
  openRequested = new EventEmitter<void>();

  private createEmptyChartData(): ChartData<'bar'> {
    return {
      labels: [],
      datasets: [
        { data: [] },
        { data: [] }
      ]
    };
  }
}
