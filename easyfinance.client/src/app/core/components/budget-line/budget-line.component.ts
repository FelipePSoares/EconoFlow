import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TranslateModule } from '@ngx-translate/core';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-budget-line',
  imports: [
    CommonModule,
    BaseChartDirective,
    TranslateModule
  ],
  templateUrl: './budget-line.component.html',
  styleUrls: ['./budget-line.component.scss']
})
export class BudgetLineComponent implements OnInit, OnChanges {
  @Input() dailyTotals?: { date: string; amount: number }[];
  @Input() transactions?: { id: number | string; date: string; amount: number }[];
  @Input() budget!: number;
  @Input() month?: string; // YYYY-MM format
  @Input() currencySymbol: string = '$';

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Cumulative Spending',
        fill: false,
        tension: 0.1,
        borderColor: '#dc3545', // Bootstrap danger color
        backgroundColor: '#dc3545',
        pointBackgroundColor: '#dc3545',
        pointBorderColor: '#dc3545',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#dc3545',
        segment: {
          borderColor: (ctx) => {
            const currentValue = ctx.p1.parsed.y;
            return currentValue > this.budget ? '#dc3545' : '#dc3545';
          }
        }
      },
      {
        data: [],
        label: 'Budget',
        fill: false,
        tension: 0,
        borderColor: '#28a745', // Bootstrap success color
        backgroundColor: '#28a745',
        pointBackgroundColor: '#28a745',
        pointBorderColor: '#28a745',
        borderDash: [5, 5]
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const formattedValue = this.currencySymbol + value.toFixed(2);
            if (label === 'Cumulative Spending') {
              return `${label}: ${formattedValue}`;
            } else {
              return `${label}: ${formattedValue}`;
            }
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Day of Month'
        },
        ticks: {
          maxTicksLimit: 10
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: `Amount (${this.currencySymbol})`
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  ngOnInit(): void {
    this.updateChartData();
  }

  ngOnChanges(): void {
    this.updateChartData();
  }

  private updateChartData(): void {
    const daysInMonth = this.getDaysInMonth();
    const cumulativeData: number[] = [];
    const budgetData: number[] = [];
    const labels: string[] = [];

    // Get daily totals from either input
    const dailyTotals = this.getDailyTotals();

    // Calculate cumulative spending for each day
    let cumulative = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(day.toString());

      const dayAmount = dailyTotals[day] || 0;
      cumulative += dayAmount;
      cumulativeData.push(cumulative);

      // Budget is constant throughout the month
      budgetData.push(this.budget);
    }

    this.lineChartData.labels = labels;
    this.lineChartData.datasets[0].data = cumulativeData;
    this.lineChartData.datasets[1].data = budgetData;

    // Update chart colors based on budget exceedance
    this.updateChartColors();
  }

  private getDailyTotals(): { [day: number]: number } {
    const dailyTotals: { [day: number]: number } = {};

    if (this.dailyTotals && this.dailyTotals.length > 0) {
      // Use provided daily totals
      this.dailyTotals.forEach(item => {
        const day = new Date(item.date).getDate();
        dailyTotals[day] = (dailyTotals[day] || 0) + item.amount;
      });
    } else if (this.transactions && this.transactions.length > 0) {
      // Aggregate transactions by day
      this.transactions.forEach(transaction => {
        const day = new Date(transaction.date).getDate();
        dailyTotals[day] = (dailyTotals[day] || 0) + Math.abs(transaction.amount);
      });
    }

    return dailyTotals;
  }

  private getDaysInMonth(): number {
    if (this.month) {
      const [year, month] = this.month.split('-').map(Number);
      return new Date(year, month, 0).getDate();
    }

    // Default to current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  private updateChartColors(): void {
    const cumulativeData = this.lineChartData.datasets[0].data as number[];

    // Update segment colors for exceedance indication
    if (this.lineChartData.datasets[0].segment) {
      this.lineChartData.datasets[0].segment = {
        borderColor: (ctx) => {
          const currentValue = ctx.p1.parsed.y;
          return currentValue > this.budget ? '#dc3545' : '#007bff'; // Red if exceeded, blue otherwise
        }
      };
    }
  }

  // Accessibility method
  getAriaLabel(): string {
    const totalDays = this.getDaysInMonth();
    return `Budget line chart showing cumulative spending over ${totalDays} days with a budget of ${this.currencySymbol}${this.budget}`;
  }
}
