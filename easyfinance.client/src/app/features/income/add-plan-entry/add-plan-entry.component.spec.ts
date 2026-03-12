import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { toUtcMomentDate } from '../../../core/utils/date';
import { AddPlanEntryComponent } from './add-plan-entry.component';

describe('AddPlanEntryComponent', () => {
  let fixture: ComponentFixture<AddPlanEntryComponent>;
  let component: AddPlanEntryComponent;
  let planServiceMock: jasmine.SpyObj<PlanService>;

  beforeEach(async () => {
    planServiceMock = jasmine.createSpyObj<PlanService>('PlanService', ['addEntry']);
    planServiceMock.addEntry.and.returnValue(of({
      id: 'entry-1',
      planId: 'plan-1',
      date: new Date('2026-03-12T00:00:00Z'),
      amountSigned: -250,
      note: 'Cash out'
    }));

    await TestBed.configureTestingModule({
      imports: [
        AddPlanEntryComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideNativeDateAdapter(),
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
        },
        {
          provide: CurrentDateService,
          useValue: {
            currentDate: new Date('2026-03-12T12:00:00')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddPlanEntryComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.planId = 'plan-1';
    fixture.detectChanges();
  });

  it('should submit negative amount for remove action', () => {
    component.entryForm.patchValue({
      action: 'remove',
      amount: 250,
      date: toUtcMomentDate(new Date('2026-03-12T12:00:00')),
      note: 'Cash out'
    });

    component.saveEntry();

    expect(planServiceMock.addEntry).toHaveBeenCalledWith('project-1', 'plan-1', jasmine.objectContaining({
      amountSigned: -250
    }));
  });

  it('should update date when selectedDate input changes', () => {
    const selectedDate = new Date('2026-04-01T12:00:00');
    component.selectedDate = selectedDate;
    component.ngOnChanges({
      selectedDate: {
        currentValue: selectedDate,
        previousValue: new Date('2026-03-01T12:00:00'),
        firstChange: false,
        isFirstChange: () => false
      }
    });

    const controlDate = component.dateControl?.value as { year: () => number; month: () => number; date: () => number; };
    expect(controlDate.year()).toBe(2026);
    expect(controlDate.month()).toBe(3);
    expect(controlDate.date()).toBe(1);
  });
});
