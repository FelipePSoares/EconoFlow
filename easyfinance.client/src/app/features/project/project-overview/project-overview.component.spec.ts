import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectOverviewComponent } from './project-overview.component';
import { PlanType } from '../../../core/enums/plan-type';
import { ProjectService } from '../../../core/services/project.service';
import { CategoryService } from '../../../core/services/category.service';
import { IncomeService } from '../../../core/services/income.service';
import { PlanService } from '../../../core/services/plan.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { Project } from '../../../core/models/project';
import { Plan } from '../../../core/models/plan';
import { UserProject } from '../../../core/models/user-project';

describe('ProjectOverviewComponent', () => {
  let fixture: ComponentFixture<ProjectOverviewComponent>;
  let component: ProjectOverviewComponent;
  let routerMock: jasmine.SpyObj<Router>;
  let projectServiceMock: jasmine.SpyObj<ProjectService>;

  beforeEach(async () => {
    routerMock = jasmine.createSpyObj<Router>('Router', ['navigate']);
    projectServiceMock = jasmine.createSpyObj<ProjectService>(
      'ProjectService',
      ['getUserProject', 'selectUserProject', 'getYearlyInfo'],
      { selectedUserProject$: of(undefined) }
    );

    const userProject = new UserProject();
    userProject.project = new Project();
    userProject.project.id = 'project-1';
    userProject.project.name = 'Project One';
    projectServiceMock.getUserProject.and.returnValue(of(userProject));

    projectServiceMock.getYearlyInfo.and.returnValue(of({
      totalBudget: 2200,
      totalSpend: 1200,
      totalOverspend: 50,
      totalRemaining: 950,
      totalEarned: 3000
    }));

    const plans: Plan[] = [
      {
        id: 'plan-1',
        projectId: 'project-1',
        type: PlanType.EmergencyReserve,
        name: 'Emergency Reserve',
        targetAmount: 5000,
        currentBalance: 1200,
        remaining: 3800,
        progress: 0.24,
        isArchived: false
      },
      {
        id: 'plan-2',
        projectId: 'project-1',
        type: PlanType.Saving,
        name: 'Savings',
        targetAmount: 10000,
        currentBalance: 800,
        remaining: 9200,
        progress: 0.08,
        isArchived: false
      }
    ];

    await TestBed.configureTestingModule({
      imports: [
        ProjectOverviewComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideNativeDateAdapter(),
        {
          provide: Router,
          useValue: routerMock
        },
        {
          provide: ProjectService,
          useValue: projectServiceMock
        },
        {
          provide: IncomeService,
          useValue: {
            get: () => of([
              {
                id: 'income-1',
                name: 'Salary',
                date: '2026-03-01',
                amount: 1200
              }
            ])
          }
        },
        {
          provide: PlanService,
          useValue: {
            getPlans: () => of(plans),
            getEntries: (_projectId: string, planId: string) => {
              if (planId === 'plan-1') {
                return of([
                  {
                    id: 'entry-1',
                    planId: 'plan-1',
                    date: new Date('2026-03-10T00:00:00Z'),
                    amountSigned: 250,
                    note: 'deposit'
                  },
                  {
                    id: 'entry-2',
                    planId: 'plan-1',
                    date: new Date('2026-02-10T00:00:00Z'),
                    amountSigned: 600,
                    note: 'older month'
                  }
                ]);
              }

              return of([
                {
                  id: 'entry-3',
                  planId: 'plan-2',
                  date: new Date('2026-03-20T00:00:00Z'),
                  amountSigned: -50,
                  note: 'withdraw'
                },
                {
                  id: 'entry-4',
                  planId: 'plan-2',
                  date: new Date('2026-03-21T00:00:00Z'),
                  amountSigned: 300,
                  note: 'deposit'
                }
              ]);
            }
          }
        },
        {
          provide: CategoryService,
          useValue: {
            get: () => of([
              {
                id: 'category-1',
                name: 'Living',
                isArchived: false,
                displayOrder: 0,
                expenses: [
                  {
                    id: 'expense-1',
                    name: 'Rent',
                    date: '2026-03-02',
                    amount: 400,
                    budget: 500,
                    isDeductible: false,
                    attachments: [],
                    temporaryAttachmentIds: [],
                    items: []
                  }
                ]
              }
            ])
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
            currentDate: new Date('2026-03-01T12:00:00')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectOverviewComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should calculate totals for income and expense', () => {
    expect(component.totalIncome).toBe(1200);
    expect(component.totalSaved).toBe(500);
    expect(component.totalExpense).toBe(400);
  });

  it('should navigate to expense overview', () => {
    component.openExpenseOverview();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'expense-overview']);
  });

  it('should navigate to incomes', () => {
    component.openIncomes();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'incomes']);
  });

  it('should navigate to income plans page', () => {
    component.openIncomePlanMode();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'income-plans']);
  });
});
