import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { PlanType } from '../../../core/enums/plan-type';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { PlanDto } from '../models/plan-dto';
import { AddEditPlanComponent } from './add-edit-plan.component';

describe('AddEditPlanComponent', () => {
  let fixture: ComponentFixture<AddEditPlanComponent>;
  let component: AddEditPlanComponent;
  let planServiceMock: jasmine.SpyObj<PlanService>;

  beforeEach(async () => {
    planServiceMock = jasmine.createSpyObj<PlanService>('PlanService', [
      'getPlans',
      'createPlan',
      'updatePlan'
    ]);
    planServiceMock.getPlans.and.returnValue(of([]));
    planServiceMock.createPlan.and.returnValue(of({
      id: 'plan-1',
      projectId: 'project-1',
      type: PlanType.Saving,
      name: 'Vacation Fund',
      targetAmount: 1200,
      currentBalance: 0,
      remaining: 1200,
      progress: 0,
      isArchived: false
    }));
    planServiceMock.updatePlan.and.returnValue(of({
      id: 'plan-1',
      projectId: 'project-1',
      type: PlanType.Saving,
      name: 'Updated Fund',
      targetAmount: 2200,
      currentBalance: 0,
      remaining: 2200,
      progress: 0,
      isArchived: false
    }));

    await TestBed.configureTestingModule({
      imports: [
        AddEditPlanComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: PlanService,
          useValue: planServiceMock
        },
        {
          provide: ErrorMessageService,
          useValue: {
            getFormFieldErrors: () => [],
            setFormErrors: jasmine.createSpy('setFormErrors')
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
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddEditPlanComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should create a plan when not editing', () => {
    component.planForm.setValue({
      type: PlanType.Saving,
      name: 'Vacation Fund',
      targetAmount: 1200
    });

    component.savePlan();

    expect(planServiceMock.createPlan).toHaveBeenCalledWith('project-1', {
      type: PlanType.Saving,
      name: 'Vacation Fund',
      targetAmount: 1200
    });
  });

  it('should update a plan when editing', () => {
    const existing = new PlanDto();
    existing.id = 'plan-1';
    existing.projectId = 'project-1';
    existing.type = PlanType.Saving;
    existing.name = 'Original Fund';
    existing.targetAmount = 1000;
    existing.currentBalance = 0;
    existing.remaining = 1000;
    existing.progress = 0;
    existing.isArchived = false;

    fixture = TestBed.createComponent(AddEditPlanComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.plan = existing;
    fixture.detectChanges();

    component.planForm.patchValue({
      name: 'Updated Fund',
      targetAmount: 2200
    });

    component.savePlan();

    expect(planServiceMock.updatePlan).toHaveBeenCalled();
  });

  it('should update form values when plan input changes', () => {
    const emergencyPlan = new PlanDto();
    emergencyPlan.id = 'plan-10';
    emergencyPlan.projectId = 'project-1';
    emergencyPlan.type = PlanType.EmergencyReserve;
    emergencyPlan.name = 'Emergency Buffer';
    emergencyPlan.targetAmount = 3000;
    emergencyPlan.currentBalance = 0;
    emergencyPlan.remaining = 3000;
    emergencyPlan.progress = 0;
    emergencyPlan.isArchived = false;

    component.planForm.patchValue({
      type: PlanType.Saving,
      name: 'Temporary Value',
      targetAmount: 150
    });

    component.plan = emergencyPlan;
    component.ngOnChanges({
      plan: new SimpleChange(null, emergencyPlan, false)
    });

    expect(component.typeControl?.value).toBe(PlanType.EmergencyReserve);
    expect(component.nameControl?.value).toBe('Emergency Buffer');
    expect(component.targetAmountControl?.value).toBe(3000);
  });

  it('should hide emergency reserve option while creating when an emergency reserve already exists', () => {
    planServiceMock.getPlans.and.returnValue(of([
      {
        id: 'plan-emergency',
        projectId: 'project-1',
        type: PlanType.EmergencyReserve,
        name: 'Emergency Reserve',
        targetAmount: 3000,
        currentBalance: 200,
        remaining: 2800,
        progress: 0.06,
        isArchived: false
      }
    ]));

    fixture = TestBed.createComponent(AddEditPlanComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();

    expect(component.availablePlanTypeOptions.some(option => option.value === PlanType.EmergencyReserve)).toBeFalse();
    expect(component.typeControl?.value).toBe(PlanType.Saving);
  });
});
