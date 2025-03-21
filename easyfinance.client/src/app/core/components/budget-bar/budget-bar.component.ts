import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyFormatPipe } from '../../utils/pipes/currency-format.pipe';

@Component({
  selector: 'app-budget-bar',
  imports: [
    CommonModule,
    CurrencyFormatPipe,
    TranslateModule
  ],
  templateUrl: './budget-bar.component.html',
  styleUrl: './budget-bar.component.css'
})
export class BudgetBarComponent {
  @Input({ required: true })
  spend!: number;
  @Input({ required: true })
  budget!: number;
  @Input({ required: true })
  overspend!: number;
  @Input({ required: true })
  remaining!: number;
  @Input()
  date!: Date | undefined;
  @Input()
  hideDecimals: boolean = false;

  getPercentageSpend(spend: number, budget: number): number {
    return budget === 0 ? 0 : spend * 100 / budget;
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'RiskOverspend';
    }

    return 'Overspend';
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 75) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }
}
