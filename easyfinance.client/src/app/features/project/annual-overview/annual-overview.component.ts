import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { TranslateModule } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { ProjectService } from '../../../core/services/project.service';
import { AnnualCategorySummary } from '../models/annual-category-summary-dto';
import { GlobalService } from '../../../core/services/global.service';
import { UserProjectDto } from '../models/user-project-dto';
import { ProjectDto } from '../models/project-dto';

interface CategoryInsight {
  name: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-annual-overview',
  imports: [
    CommonModule,
    TranslateModule,
    BaseChartDirective,
    CurrencyFormatPipe
  ],
  templateUrl: './annual-overview.component.html',
  styleUrl: './annual-overview.component.css'
})
export class AnnualOverviewComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;

  readonly currentYear = new Date().getFullYear();
  readonly yearOptions = Array.from({ length: 8 }, (_, index) => this.currentYear - index);
  selectedYear = this.currentYear;

  userProject!: UserProjectDto;

  totalExpenses = 0;
  totalIncomes = 0;
  balance = 0;

  expenseInsights: CategoryInsight[] = [];

  private expenseColors = ['#dc3545', '#e35d6a', '#f08b94', '#f6b3b9', '#fbe1e4', '#b02a37', '#721c24', '#fcdde1'];

  expenseChartData: ChartData<'doughnut'> = this.createEmptyChartData();

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => this.formatTooltipLabel(context)
        }
      }
    }
  };

  constructor(
    private projectService: ProjectService,
    private globalService: GlobalService
  ) { }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      const defaultProject = new UserProjectDto();
      defaultProject.project = new ProjectDto();
      this.userProject = userProject ?? defaultProject;
    });

    this.projectService.getUserProject(this.projectId).subscribe(userProject => {
      this.userProject = userProject;
      this.projectService.selectUserProject(userProject);
    });

    this.loadYear(this.selectedYear);
  }

  onYearChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const selectedYear = Number(target?.value ?? this.currentYear);
    this.selectedYear = Number.isFinite(selectedYear) ? selectedYear : this.currentYear;
    this.loadYear(this.selectedYear);
  }

  private loadYear(year: number): void {
    forkJoin({
      yearlySummary: this.projectService.getYearlyInfo(this.projectId, year),
      expensesByCategory: this.projectService.getAnnualExpensesByCategory(this.projectId, year)
    }).subscribe({
      next: ({ yearlySummary, expensesByCategory }) => {
        this.totalExpenses = yearlySummary.totalSpend + yearlySummary.totalOverspend;
        this.totalIncomes = yearlySummary.totalEarned;
        this.balance = this.totalIncomes - this.totalExpenses;

        this.expenseChartData = this.toChartData(expensesByCategory, this.expenseColors);
        this.expenseInsights = this.toInsights(expensesByCategory);
      },
      error: () => {
        this.totalExpenses = 0;
        this.totalIncomes = 0;
        this.balance = 0;
        this.expenseChartData = this.createEmptyChartData();
        this.expenseInsights = [];
      }
    });
  }

  private toChartData(data: AnnualCategorySummary[], colors: string[]): ChartData<'doughnut'> {
    if (!data.length) {
      return this.createEmptyChartData();
    }

    return {
      labels: data.map(item => item.name),
      datasets: [
        {
          data: data.map(item => item.amount),
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderColor: '#ffffff',
          borderWidth: 1
        }
      ]
    };
  }

  private toInsights(data: AnnualCategorySummary[]): CategoryInsight[] {
    const total = data.reduce((sum, item) => sum + item.amount, 0);

    if (!total) {
      return [];
    }

    return data.slice(0, 5).map(item => ({
      name: item.name,
      amount: item.amount,
      percentage: (item.amount / total) * 100
    }));
  }

  private createEmptyChartData(): ChartData<'doughnut'> {
    return {
      labels: [],
      datasets: [{ data: [] }]
    };
  }

  private formatTooltipLabel(context: TooltipItem<'doughnut'>): string {
    const label = context.label || '';
    const value = Number(context.parsed) || 0;
    const total = context.dataset.data.reduce((sum, current) => sum + Number(current || 0), 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return `${label}: ${this.formatCurrency(value)} (${percentage.toFixed(1)}%)`;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.globalService.currentLanguage, {
      style: 'currency',
      currency: this.globalService.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
