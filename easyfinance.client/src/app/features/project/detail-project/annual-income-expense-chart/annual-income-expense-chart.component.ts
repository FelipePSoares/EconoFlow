import { AfterViewInit, Component, inject, Input, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-annual-income-expense-chart',
  imports: [BaseChartDirective, TranslateModule],
  templateUrl: './annual-income-expense-chart.component.html',
  styleUrl: './annual-income-expense-chart.component.css'
})
export class AnnualIncomeExpenseChartComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  @Input() chartData: ChartData<'bar'> = this.createEmptyChartData();
  @Input() chartOptions: ChartOptions<'bar'> = {};

  isBrowser = isPlatformBrowser(this.platformId);
  chartsReady = false;

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.chartsReady = true;
      }, 0);
    }
  }

  public hasData(): boolean {
    return this.chartData.datasets.some(dataset => (dataset.data?.length ?? 0) > 0);
  }

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
