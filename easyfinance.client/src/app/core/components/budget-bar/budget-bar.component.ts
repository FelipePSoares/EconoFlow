import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CurrencyFormatPipe } from '../../utils/pipes/currency-format.pipe';
import { CurrentDateService } from '../../services/current-date.service';
import { GlobalService } from '../../services/global.service';

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
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

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
  hideDecimals = false;
  @Input()
  typeMonthOrYear = 'month';

  currentLanguage = this.globalService.currentLanguage;

  constructor(private currentDateService: CurrentDateService) { }

  ngOnInit(): void {
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
      });
  }

  get weekLines(): number[] {
    if(this.checkIfCurrentMonth()) {
      return Array.from({ length: 3 }, (_, i) => ((i + 1) / 4) * 100);
    }
    return [];
  }

  getPercentageSpend(spend: number, budget: number): number {
    return budget === 0 ? 0 : spend * 100 / budget;
  }

  getClassBasedOnPercentage(percentage: number): string {
    return this.test(percentage, '', 'warning', 'danger');
  }

  getTextBasedOnPercentage(percentage: number): string {
    return this.test(percentage, '', 'RiskOverspend', 'Overspend');
  }

  getClassToProgressBar(percentage: number): string {
    return this.test(percentage, 'bg-info', 'bg-warning', 'bg-danger');
  }

  getCurrPercentageOfMonth():number{
    const today = new Date();
    return today ? (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100 : 0;
  }

  checkIfCurrentMonth(): boolean {
    const today = new Date();
    return this.typeMonthOrYear == "month" && today.getMonth() == this.currentDateService.currentDate.getMonth() && today.getFullYear() == this.currentDateService.currentDate.getFullYear();
  }

  checktypeMonthOrYear(): string {
    return this.typeMonthOrYear;
  }

  private test(percentage: number, normalText: string, warningText: string, dangerText: string): string {
    if (this.checkIfCurrentMonth()) {
      if (percentage <= this.getCurrPercentageOfMonth()) {
        return normalText;
      } else if (percentage <= 100 && percentage > this.getCurrPercentageOfMonth()) {
        return warningText;
      }

      return dangerText;
    } else {
      if (percentage <= 100)
        return normalText;
      else
        return dangerText;
    }
  }
}
