import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Plan } from '../../../core/models/plan';
import { PlanEntryRequest } from '../../../core/models/plan-entry';
import { PlanType } from '../../../core/enums/plan-type';
import { PlanService } from '../../../core/services/plan.service';
import { GlobalService } from '../../../core/services/global.service';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { formatDate } from '../../../core/utils/date';
import { IncomeDto } from '../models/income-dto';

@Component({
  selector: 'app-plan-allocation-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    TranslateModule,
    CurrencyFormatPipe
  ],
  templateUrl: './plan-allocation-dialog.component.html',
  styleUrl: './plan-allocation-dialog.component.css'
})
export class PlanAllocationDialogComponent implements OnInit {
  private planService = inject(PlanService);
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private snackbar = inject(SnackbarComponent);

  @Input({ required: true }) projectId!: string;
  @Input({ required: true }) income!: IncomeDto;
  @Input({ required: true }) plans!: Plan[];
  @Input() closeDialog: ((allocated: boolean) => void) | null = null;

  selectedPlanId = '';
  allocationAmount = 0;
  isAllocating = false;

  ngOnInit(): void {
    this.preselectPlan();
    this.allocationAmount = Math.min(
      Math.round(this.income.amount * 0.1 * 100) / 100,
      this.income.amount
    );
  }

  get selectedPlan(): Plan | undefined {
    return this.plans.find(p => p.id === this.selectedPlanId);
  }

  get remainingIncome(): number {
    return this.income.amount - this.allocationAmount;
  }

  get sliderStep(): number {
    const max = this.income.amount;
    if (max <= 100) return 1;
    if (max <= 1000) return 5;
    if (max <= 10000) return 10;
    return 50;
  }

  formatSliderLabel = (value: number): string => {
    return this.globalService.currencySymbol + value.toFixed(0);
  };

  onPlanChange(): void {
    if (this.allocationAmount > this.income.amount) {
      this.allocationAmount = this.income.amount;
    }
  }

  allocate(): void {
    if (!this.selectedPlanId || this.allocationAmount <= 0 || this.isAllocating) {
      return;
    }

    this.isAllocating = true;

    const request: PlanEntryRequest = {
      date: formatDate(this.income.date),
      amountSigned: this.allocationAmount,
      note: this.translateService.instant('PlanAllocationNote', { value: this.income.name })
    };

    this.planService.addEntry(this.projectId, this.selectedPlanId, request).subscribe({
      next: () => {
        this.isAllocating = false;
        this.snackbar.openSuccessSnackbar(this.translateService.instant('PlanAllocationSuccess'));
        this.closeDialog?.(true);
      },
      error: () => {
        this.isAllocating = false;
        this.snackbar.openErrorSnackbar(this.translateService.instant('PlanAllocationError'));
      }
    });
  }

  skip(): void {
    this.closeDialog?.(false);
  }

  private preselectPlan(): void {
    const emergencyReserve = this.plans.find(
      p => p.type === PlanType.EmergencyReserve && p.remaining > 0
    );

    if (emergencyReserve) {
      this.selectedPlanId = emergencyReserve.id;
      return;
    }

    if (this.plans.length > 0) {
      this.selectedPlanId = this.plans[0].id;
    }
  }
}
