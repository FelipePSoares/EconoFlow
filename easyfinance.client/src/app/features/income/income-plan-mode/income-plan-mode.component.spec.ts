import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { PlanType } from '../../../core/enums/plan-type';
import { Plan } from '../../../core/models/plan';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { PlanDto } from '../models/plan-dto';
import { PlanEntryDto } from '../models/plan-entry-dto';
import { IncomePlanModeComponent } from './income-plan-mode.component';

describe('IncomePlanModeComponent', () => {
  let fixture: ComponentFixture<IncomePlanModeComponent>;
  let component: IncomePlanModeComponent;
  let planServiceMock: jasmine.SpyObj<PlanService>;

  beforeEach(async () => {
    const routerEvents = new BehaviorSubject(new NavigationEnd(
      1,
      '/projects/project-1/income-plans',
      '/projects/project-1/income-plans'
    ));

    const routerMock = {
      url: '/projects/project-1/income-plans',
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

    planServiceMock = jasmine.createSpyObj<PlanService>('PlanService', [
      'getPlans',
      'createPlan',
      'updatePlan',
      'archivePlan',
      'getEntries',
      'addEntry'
    ]);

    const initialPlans: Plan[] = [
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
      }
    ];

    const createdPlan: Plan = {
      id: 'plan-2',
      projectId: 'project-1',
      type: PlanType.Saving,
      name: 'Vacation Fund',
      targetAmount: 2500,
      currentBalance: 0,
      remaining: 2500,
      progress: 0,
      isArchived: false
    };

    planServiceMock.getPlans.and.returnValues(
      of(initialPlans),
      of([initialPlans[0], createdPlan]),
      of(initialPlans)
    );
    planServiceMock.getEntries.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        IncomePlanModeComponent,
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
          useValue: {
            open: () => ({
              afterClosed: () => of(false)
            })
          }
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
        },
        {
          provide: ErrorMessageService,
          useValue: {
            getFormFieldErrors: () => [],
            setFormErrors: jasmine.createSpy('setFormErrors')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncomePlanModeComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should load plans', () => {
    expect(planServiceMock.getPlans).toHaveBeenCalledWith('project-1');
    expect(planServiceMock.getEntries).toHaveBeenCalledWith('project-1', 'plan-1');
  });

  it('should enter create-plan mode', () => {
    component.startCreatePlan();

    expect(component.isCreatingPlan).toBeTrue();
    expect(component.editingPlan).toBeNull();
  });

  it('should reload plans after plan is saved', () => {
    const savedPlan = new PlanDto();
    savedPlan.id = 'plan-2';
    savedPlan.projectId = 'project-1';
    savedPlan.type = PlanType.Saving;
    savedPlan.name = 'Vacation Fund';
    savedPlan.targetAmount = 2500;
    savedPlan.currentBalance = 0;
    savedPlan.remaining = 2500;
    savedPlan.progress = 0;
    savedPlan.isArchived = false;

    component.onPlanSaved(savedPlan);

    expect(planServiceMock.getPlans).toHaveBeenCalledTimes(2);
    expect(planServiceMock.getEntries).toHaveBeenCalledWith('project-1', 'plan-2');
  });

  it('should reload plans after a plan entry is added', () => {
    const savedEntry = new PlanEntryDto();
    savedEntry.id = 'entry-1';
    savedEntry.planId = 'plan-1';
    savedEntry.date = new Date('2026-03-12');
    savedEntry.amountSigned = -250;
    savedEntry.note = 'Cash out';

    component.onPlanEntrySaved(savedEntry);

    expect(planServiceMock.getPlans).toHaveBeenCalledTimes(2);
    expect(planServiceMock.getEntries).toHaveBeenCalledWith('project-1', 'plan-1');
  });
});
