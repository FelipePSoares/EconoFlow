import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-monthly-expenses-chart',
  imports: [BaseChartDirective],
  templateUrl: './monthly-expenses-chart.component.html',
  styleUrl: './monthly-expenses-chart.component.css'
})
export class MonthlyExpensesChartComponent implements OnInit, OnChanges {
  @Input() data: { month: string, amount: number }[] = [];
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Monthly Expenses',
        fill: true,
        tension: 0.5,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)'
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
  };

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.updateChartData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.updateChartData();
      // Force chart update with change detection
      setTimeout(() => {
        try {
          // Update the chart
          this.chart?.update();
        } catch (error) {
          // Fallback for older ng2-charts versions
          this.chart?.chart?.update?.();
        }
        this.cdr.markForCheck();
      }, 0);
    }
  }

  private updateChartData() {
    // Create new object reference to trigger change detection
    this.lineChartData = {
      ...this.lineChartData,
      labels: this.data.map(d => d.month),
      datasets: [{
        ...this.lineChartData.datasets[0],
        data: this.data.map(d => d.amount)
      }]
    };
  }
}
