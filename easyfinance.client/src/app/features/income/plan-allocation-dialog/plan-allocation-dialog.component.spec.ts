import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { PlanType } from '../../../core/enums/plan-type';
import { Plan } from '../../../core/models/plan';
import { PlanService } from '../../../core/services/plan.service';
import { GlobalService } from '../../../core/services/global.service';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { IncomeDto } from '../models/income-dto';
import { PlanAllocationDialogComponent } from './plan-allocation-dialog.component';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  const plan = new Plan();
  plan.id = overrides.id ?? 'plan-1';
  plan.projectId = overrides.projectId ?? 'project-1';
  plan.type = overrides.type ?? PlanType.Saving;
  plan.name = overrides.name ?? 'Savings';
  plan.targetAmount = overrides.targetAmount ?? 10000;
  plan.currentBalance = overrides.currentBalance ?? 2000;
  plan.remaining = overrides.remaining ?? 8000;
  plan.progress = overrides.progress ?? 0.2;
  plan.isArchived = overrides.isArchived ?? false;
  return plan;
}

function makeIncome(overrides: Partial<IncomeDto> = {}): IncomeDto {
  const dto = new IncomeDto();
  dto.id = overrides.id ?? 'income-1';
  dto.name = overrides.name ?? 'Salary';
  dto.date = overrides.date ?? new Date('2026-04-16');
  dto.amount = overrides.amount ?? 5000;
  return dto;
}

describe('PlanAllocationDialogComponent', () => {
  let fixture: ComponentFixture<PlanAllocationDialogComponent>;
  let component: PlanAllocationDialogComponent;
  let planServiceMock: jasmine.SpyObj<PlanService>;
  let snackbarMock: jasmine.SpyObj<SnackbarComponent>;

  beforeEach(async () => {
    planServiceMock = jasmine.createSpyObj<PlanService>('PlanService', ['addEntry']);
    planServiceMock.addEntry.and.returnValue(of({
      id: 'entry-1',
      planId: 'plan-1',
      date: new Date('2026-04-16'),
      amountSigned: 500,
      note: 'Allocation from income: Salary'
    }));

    snackbarMock = jasmine.createSpyObj<SnackbarComponent>('SnackbarComponent', [
      'openSuccessSnackbar',
      'openErrorSnackbar'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        PlanAllocationDialogComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: PlanService, useValue: planServiceMock },
        { provide: SnackbarComponent, useValue: snackbarMock },
        {
          provide: GlobalService,
          useValue: {
            currentLanguage: 'en',
            currency: 'USD',
            currencySymbol: '$',
            groupSeparator: ',',
            decimalSeparator: '.'
          }
        }
      ]
    }).compileComponents();
  });

  function createComponent(plans: Plan[], income?: IncomeDto): void {
    fixture = TestBed.createComponent(PlanAllocationDialogComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.income = income ?? makeIncome();
    component.plans = plans;
    component.closeDialog = jasmine.createSpy('closeDialog');
    fixture.detectChanges();
  }

  it('should pre-select Emergency Reserve plan when it exists and is active', () => {
    const emergencyPlan = makePlan({ id: 'er-1', type: PlanType.EmergencyReserve, name: 'Emergency Reserve', remaining: 5000 });
    const savingsPlan = makePlan({ id: 'sav-1', type: PlanType.Saving, name: 'Vacation', remaining: 3000 });

    createComponent([savingsPlan, emergencyPlan]);

    expect(component.selectedPlanId).toBe('er-1');
  });

  it('should fall back to first plan when no Emergency Reserve exists', () => {
    const plan1 = makePlan({ id: 'sav-1', name: 'Vacation' });
    const plan2 = makePlan({ id: 'sav-2', name: 'Car' });

    createComponent([plan1, plan2]);

    expect(component.selectedPlanId).toBe('sav-1');
  });

  it('should fall back to first plan when Emergency Reserve has no remaining', () => {
    const emergencyPlan = makePlan({ id: 'er-1', type: PlanType.EmergencyReserve, remaining: 0 });
    const savingsPlan = makePlan({ id: 'sav-1', type: PlanType.Saving, remaining: 3000 });

    createComponent([emergencyPlan, savingsPlan]);

    expect(component.selectedPlanId).toBe('er-1');
  });

  it('should set initial allocation to 10% of income amount', () => {
    createComponent([makePlan()], makeIncome({ amount: 5000 }));

    expect(component.allocationAmount).toBe(500);
  });

  it('should cap initial allocation at income amount', () => {
    createComponent([makePlan()], makeIncome({ amount: 5 }));

    expect(component.allocationAmount).toBe(0.5);
  });

  it('should compute remaining income correctly', () => {
    createComponent([makePlan()], makeIncome({ amount: 5000 }));
    component.allocationAmount = 1500;

    expect(component.remainingIncome).toBe(3500);
  });

  it('should call planService.addEntry with correct payload on allocate', () => {
    createComponent([makePlan({ id: 'plan-1' })], makeIncome({ name: 'Salary', date: new Date('2026-04-16'), amount: 5000 }));
    component.allocationAmount = 1000;

    component.allocate();

    expect(planServiceMock.addEntry).toHaveBeenCalledWith('project-1', 'plan-1', jasmine.objectContaining({
      date: '2026-04-16',
      amountSigned: 1000
    }));
  });

  it('should show success snackbar and close dialog on successful allocation', () => {
    createComponent([makePlan()]);
    component.allocationAmount = 500;

    component.allocate();

    expect(snackbarMock.openSuccessSnackbar).toHaveBeenCalled();
    expect(component.closeDialog).toHaveBeenCalledWith(true);
  });

  it('should show error snackbar on allocation failure', () => {
    planServiceMock.addEntry.and.returnValue(throwError(() => new Error('Server error')));
    createComponent([makePlan()]);
    component.allocationAmount = 500;

    component.allocate();

    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalled();
    expect(component.closeDialog).not.toHaveBeenCalled();
  });

  it('should call closeDialog(false) on skip', () => {
    createComponent([makePlan()]);

    component.skip();

    expect(component.closeDialog).toHaveBeenCalledWith(false);
  });

  it('should not allocate when amount is 0', () => {
    createComponent([makePlan()]);
    component.allocationAmount = 0;

    component.allocate();

    expect(planServiceMock.addEntry).not.toHaveBeenCalled();
  });

  it('should not allocate when no plan is selected', () => {
    createComponent([makePlan()]);
    component.selectedPlanId = '';
    component.allocationAmount = 500;

    component.allocate();

    expect(planServiceMock.addEntry).not.toHaveBeenCalled();
  });

  it('should not allocate when already allocating', () => {
    createComponent([makePlan()]);
    component.allocationAmount = 500;
    component.isAllocating = true;

    component.allocate();

    expect(planServiceMock.addEntry).not.toHaveBeenCalled();
  });

  it('should compute slider step based on income amount', () => {
    createComponent([makePlan()], makeIncome({ amount: 50 }));
    expect(component.sliderStep).toBe(1);

    component.income = makeIncome({ amount: 500 });
    expect(component.sliderStep).toBe(5);

    component.income = makeIncome({ amount: 5000 });
    expect(component.sliderStep).toBe(10);

    component.income = makeIncome({ amount: 50000 });
    expect(component.sliderStep).toBe(50);
  });
});
