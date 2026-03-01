import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { AddExpenseComponent } from './add-expense.component';
import { ExpenseService } from '../../../core/services/expense.service';
import { CategoryService } from '../../../core/services/category.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { ExpenseDto } from '../models/expense-dto';
import { AttachmentType } from '../../../core/enums/attachment-type';

describe('AddExpenseComponent', () => {
  let fixture: ComponentFixture<AddExpenseComponent>;
  let component: AddExpenseComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AddExpenseComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        provideNativeDateAdapter(),
        {
          provide: ExpenseService,
          useValue: {
            add: () => of({}),
            update: () => of({}),
            uploadTemporaryAttachment: () => of({ id: 'temp-1' }),
            uploadAttachment: () => of({ id: 'attachment-1' }),
            removeAttachment: () => of(true),
            getAttachmentDownloadUrl: () => '/api/mock/attachment'
          }
        },
        {
          provide: CategoryService,
          useValue: {
            get: () => of([])
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate')
          }
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
            groupSeparator: ',',
            decimalSeparator: '.',
            currencySymbol: '$',
            currentLanguage: 'en'
          }
        },
        {
          provide: CurrentDateService,
          useValue: {
            currentDate: new Date('2026-03-01T00:00:00Z')
          }
        },

        {
          provide: SnackbarComponent,
          useValue: {
            openSuccessSnackbar: jasmine.createSpy('openSuccessSnackbar'),
            openErrorSnackbar: jasmine.createSpy('openErrorSnackbar')
          }
        }
      ]
    }).compileComponents();
  });

  const createExpense = (isDeductible: boolean): ExpenseDto => {
    const expense = new ExpenseDto();
    expense.id = 'expense-1';
    expense.name = 'Rent';
    expense.date = new Date('2026-03-01T00:00:00Z');
    expense.amount = 1200;
    expense.budget = 1300;
    expense.isDeductible = isDeductible;
    expense.temporaryAttachmentIds = [];
    expense.items = [];
    expense.attachments = isDeductible ? [{
      id: 'proof-1',
      name: 'invoice.pdf',
      contentType: 'application/pdf',
      size: 1234,
      attachmentType: AttachmentType.DeductibleProof,
      isTemporary: false
    }] : [];
    return expense;
  };

  const setupComponent = (expense?: ExpenseDto): void => {
    fixture = TestBed.createComponent(AddExpenseComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.categoryId = 'category-1';
    component.expense = expense;
    fixture.detectChanges();
  };

  it('should hide deductible proof section by default', () => {
    setupComponent();
    const section = fixture.nativeElement.querySelector('[data-testid="deductible-proof-section"]');
    expect(section).toBeNull();
  });

  it('should show deductible proof section when deductible is enabled', () => {
    setupComponent();
    component.isDeductibleControl?.setValue(true);
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('[data-testid="deductible-proof-section"]');
    expect(section).not.toBeNull();
  });

  it('should render existing deductible proof when editing deductible expense', () => {
    setupComponent(createExpense(true));

    const existingProof = fixture.nativeElement.querySelector('[data-testid="deductible-proof-existing"]');
    expect(existingProof).not.toBeNull();
    expect(existingProof.textContent).toContain('invoice.pdf');
  });
});

