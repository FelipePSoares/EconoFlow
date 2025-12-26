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
  @Input() expenses: any[] = [];
  @Input() expenseItems: any[] = [];
  @Input() transactions: any[] = [];
  @Input() budget: number = 0;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Cumulative Spending',
        fill: true,
        tension: 0.5,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        pointBackgroundColor: (context: any) => {
          const raw = context?.parsed?.y;
          const value = typeof raw === 'number' ? raw : 0;
          const budget = typeof this.budget === 'number' ? this.budget : 0;
          return value > budget ? 'rgb(255, 0, 0)' : 'rgb(255, 99, 132)';
        },
        pointBorderColor: (context: any) => {
          const raw = context?.parsed?.y;
          const value = typeof raw === 'number' ? raw : 0;
          const budget = typeof this.budget === 'number' ? this.budget : 0;
          return value > budget ? 'rgb(255, 0, 0)' : 'rgb(255, 99, 132)';
        }
      },
      {
        data: [],
        label: 'Budget',
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
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
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.updateChartData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['expenses'] || changes['expenseItems'] || changes['transactions'] || changes['budget']) {
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

  updateChartData() {
    // Determine current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based
    const daysInMonth = new Date(year, month, 0).getDate();

    // Aggregate expenses by date
    const dailySums: { [date: string]: number } = {};

    // Process expenses
    const allRecords = [
      ...(this.expenses || []),
      ...(this.expenseItems || []),
      ...(this.transactions || [])
    ];

    for (const record of allRecords) {
      let amount = 0;
      let date: Date | null = null;

      // Extract amount
      if (typeof record.amount === 'number') {
        amount = record.amount;
      } else if (record.items && Array.isArray(record.items)) {
        amount = record.items.reduce((sum: number, item: any) => {
          if (typeof item.amount === 'number') return sum + item.amount;
          if (typeof item.value === 'number') return sum + item.value;
          if (typeof item.price === 'number') return sum + item.price;
          if (item.items && Array.isArray(item.items)) {
            return sum + item.items.reduce((subSum: number, subItem: any) => {
              return subSum + (typeof subItem.amount === 'number' ? subItem.amount :
                             typeof subItem.value === 'number' ? subItem.value :
                             typeof subItem.price === 'number' ? subItem.price : 0);
            }, 0);
          }
          return sum;
        }, 0);
      }

      // Extract date
      if (record.date) {
        date = new Date(record.date);
      }

      if (amount > 0 && date) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dailySums[dateStr] = (dailySums[dateStr] || 0) + amount;
      }
    }

    // Filter to current month
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    const currentMonthSums: { [day: number]: number } = {};
    for (const [dateStr, sum] of Object.entries(dailySums)) {
      if (dateStr.startsWith(monthPrefix)) {
        const day = parseInt(dateStr.split('-')[2]);
        currentMonthSums[day] = sum;
      }
    }

    // Build cumulative
    const cumulative: number[] = [];
    let runningTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayAmount = currentMonthSums[day] || 0;
      runningTotal += dayAmount;
      cumulative.push(runningTotal);
    }

    // Budget line
    const budgetLine = new Array(daysInMonth).fill(this.budget);

    // Labels
    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

    // Update chart data
    this.lineChartData = {
      ...this.lineChartData,
      labels,
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data: cumulative
        },
        {
          ...this.lineChartData.datasets[1],
          data: budgetLine
        }
      ]
    };
  }
}
