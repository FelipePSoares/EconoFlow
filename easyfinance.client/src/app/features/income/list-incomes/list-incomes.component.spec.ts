import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of, EMPTY } from 'rxjs';
import { PlanType } from '../../../core/enums/plan-type';
import { Plan } from '../../../core/models/plan';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { IncomeService } from '../../../core/services/income.service';
import { PlanService } from '../../../core/services/plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { IncomeDto } from '../models/income-dto';
import { PlanAllocationDialogComponent } from '../plan-allocation-dialog/plan-allocation-dialog.component';
import { ListIncomesComponent } from './list-incomes.component';

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

function makeIncome(): IncomeDto {
  const dto = new IncomeDto();
  dto.id = 'income-1';
  dto.name = 'Salary';
  dto.date = new Date('2026-03-01');
  dto.amount = 1200;
  return dto;
}

describe('ListIncomesComponent', () => {
  let fixture: ComponentFixture<ListIncomesComponent>;
  let component: ListIncomesComponent;
  let incomeServiceMock: jasmine.SpyObj<IncomeService>;
  let planServiceMock: jasmine.SpyObj<PlanService>;
  let dialogMock: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    const routerEvents = new BehaviorSubject(new NavigationEnd(
      1,
      '/projects/project-1/incomes',
      '/projects/project-1/incomes'
    ));

    const routerMock = {
      url: '/projects/project-1/incomes',
      events: routerEvents.asObservable(),
      navigate: jasmine.createSpy('navigate'),
      parseUrl: (url: string) => {
        const segments = url.split('?')[0].split('/').filter(Boolean).map(path => ({ path }));
        return {
          root: {
            children: {
              primary: { segments }
            }
          }
        } as unknown as ReturnType<Router['parseUrl']>;
      }
    } as unknown as Router;

    incomeServiceMock = jasmine.createSpyObj<IncomeService>('IncomeService', ['get', 'remove']);
    incomeServiceMock.get.and.returnValue(of([
      {
        id: 'income-1',
        name: 'Salary',
        amount: 1200,
        date: new Date('2026-03-01')
      }
    ]));
    incomeServiceMock.remove.and.returnValue(of(true));

    planServiceMock = jasmine.createSpyObj<PlanService>('PlanService', ['getPlans']);
    planServiceMock.getPlans.and.returnValue(of([]));

    dialogMock = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialogMock.open.and.returnValue({
      afterClosed: () => of(false)
    } as any);

    await TestBed.configureTestingModule({
      imports: [
        ListIncomesComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideNativeDateAdapter(),
        {
          provide: Router,
          useValue: routerMock
        },
        {
          provide: MatDialog,
          useValue: dialogMock
        },
        {
          provide: IncomeService,
          useValue: incomeServiceMock
        },
        {
          provide: PlanService,
          useValue: planServiceMock
        },
        {
          provide: ProjectService,
          useValue: {
            selectedUserProject$: of({
              role: 'Admin',
              project: { id: 'project-1', name: 'Project One' }
            }),
            getUserProject: () => of({
              role: 'Admin',
              project: { id: 'project-1', name: 'Project One' }
            }),
            selectUserProject: jasmine.createSpy('selectUserProject')
          }
        },
        {
          provide: GlobalService,
          useValue: {
            currentLanguage: 'en',
            currency: 'USD',
            currencySymbol: '$',
            groupSeparator: ',',
            decimalSeparator: '.'
          }
        },
        {
          provide: CurrentDateService,
          useValue: {
            currentDate: new Date('2026-03-12T12:00:00')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListIncomesComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should load incomes on init', () => {
    expect(incomeServiceMock.get).toHaveBeenCalledWith('project-1', jasmine.any(Date));
  });

  it('should enter create-income mode', () => {
    component.startCreateIncome();

    expect(component.isCreatingIncome).toBeTrue();
    expect(component.editingIncomeId).toBeNull();
  });

  it('should reload incomes after income is saved', () => {
    component.onIncomeSaved();

    expect(incomeServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('should reload data for selected date', () => {
    component.updateDate(new Date('2026-04-01T12:00:00'));

    expect(incomeServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('should open plan allocation dialog after creating income when active plans exist', () => {
    const activePlan = makePlan({ remaining: 5000 });
    planServiceMock.getPlans.and.returnValue(of([activePlan]));

    component.isCreatingIncome = true;
    component.onIncomeSaved(makeIncome());

    expect(planServiceMock.getPlans).toHaveBeenCalledWith('project-1');
    expect(dialogMock.open).toHaveBeenCalledWith(
      PageModalComponent,
      jasmine.objectContaining({
        data: jasmine.objectContaining({
          title: 'PlanAllocationDialogTitle',
          component: PlanAllocationDialogComponent
        })
      })
    );
  });

  it('should not open plan allocation dialog when editing income', () => {
    component.isCreatingIncome = false;
    component.editingIncomeId = 'income-1';
    component.onIncomeSaved(makeIncome());

    expect(planServiceMock.getPlans).not.toHaveBeenCalled();
  });

  it('should not open plan allocation dialog when no active plans exist', () => {
    planServiceMock.getPlans.and.returnValue(of([]));

    component.isCreatingIncome = true;
    component.onIncomeSaved(makeIncome());

    expect(planServiceMock.getPlans).toHaveBeenCalledWith('project-1');
    expect(dialogMock.open).not.toHaveBeenCalledWith(
      PageModalComponent,
      jasmine.anything()
    );
  });

  it('should not open plan allocation dialog when all plans are fully funded', () => {
    const fullyFundedPlan = makePlan({ remaining: 0 });
    planServiceMock.getPlans.and.returnValue(of([fullyFundedPlan]));

    component.isCreatingIncome = true;
    component.onIncomeSaved(makeIncome());

    expect(dialogMock.open).not.toHaveBeenCalledWith(
      PageModalComponent,
      jasmine.anything()
    );
  });

  it('should not check plans when onIncomeSaved called without income', () => {
    component.isCreatingIncome = true;
    component.onIncomeSaved();

    expect(planServiceMock.getPlans).not.toHaveBeenCalled();
  });
});
