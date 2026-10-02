/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { provideMomentDateAdapter, MAT_MOMENT_DATE_FORMATS } from '@angular/material-moment-adapter';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { AddExpenseItemComponent } from './add-expense-item.component';
import { ExpenseService } from '../../../core/services/expense.service';
import { CategoryService } from '../../../core/services/category.service';
import { ProjectService } from '../../../core/services/project.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../../../core/utils/attachment-policy';

describe('AddExpenseItemComponent deductible proof validation', () => {
  let fixture: ComponentFixture<AddExpenseItemComponent>;
  let component: AddExpenseItemComponent;
  let expenseServiceMock: jasmine.SpyObj<ExpenseService>;
  let snackbarMock: jasmine.SpyObj<SnackbarComponent>;

  beforeEach(async () => {
    expenseServiceMock = jasmine.createSpyObj<ExpenseService>('ExpenseService', [
      'get',
      'getById',
      'update',
      'moveExpenseItem',
      'uploadTemporaryExpenseItemAttachment',
      'uploadTemporaryExpenseItemAttachmentWithProgress',
      'removeExpenseItemAttachment',
      'getExpenseItemAttachmentDownloadUrl'
    ]);
    expenseServiceMock.get.and.returnValue(of([]));
    expenseServiceMock.uploadTemporaryExpenseItemAttachmentWithProgress.and.returnValue(of({
      type: HttpEventType.Response,
      body: {
        id: 'temp-item-1',
        name: 'proof.pdf',
        contentType: 'application/pdf',
        size: 10,
        attachmentType: 'DeductibleProof',
        isTemporary: true
      }
    } as any));

    snackbarMock = jasmine.createSpyObj<SnackbarComponent>('SnackbarComponent', [
      'openSuccessSnackbar',
      'openErrorSnackbar'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        AddExpenseItemComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        provideMomentDateAdapter(MAT_MOMENT_DATE_FORMATS, { useUtc: true }),
        { provide: ExpenseService, useValue: expenseServiceMock },
        { provide: CategoryService, useValue: { get: () => of([]) } },
        { provide: ProjectService, useValue: { getTaxYearSettings: () => of(null) } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
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
        { provide: CurrentDateService, useValue: { currentDate: new Date('2026-03-01T00:00:00Z') } },
        { provide: SnackbarComponent, useValue: snackbarMock }
      ]
    }).compileComponents();
  });

  const setupComponent = (): void => {
    fixture = TestBed.createComponent(AddExpenseItemComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.categoryId = 'category-1';
    component.expenseId = 'expense-1';
    fixture.detectChanges();
  };

  const selectFile = (file: File): Event => {
    const inputElement = document.createElement('input');
    Object.defineProperty(inputElement, 'files', { value: [file], configurable: true });
    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: inputElement, configurable: true });
    return changeEvent;
  };

  it('rejects a file with an unsupported content type', () => {
    setupComponent();

    component.onDeductibleProofSelected(
      selectFile(new File(['notes'], 'notes.txt', { type: 'text/plain' }))
    );

    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalledWith('DeductibleProofInvalidFileType');
    expect(expenseServiceMock.uploadTemporaryExpenseItemAttachmentWithProgress).not.toHaveBeenCalled();
  });

  it('rejects a file above the shared maximum size', () => {
    setupComponent();

    const oversized = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: MAX_ATTACHMENT_SIZE_BYTES + 1, configurable: true });

    component.onDeductibleProofSelected(selectFile(oversized));

    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalledWith('DeductibleProofFileSizeExceeded');
    expect(expenseServiceMock.uploadTemporaryExpenseItemAttachmentWithProgress).not.toHaveBeenCalled();
  });

  it('does not report an error for a valid file', () => {
    setupComponent();

    component.onDeductibleProofSelected(
      selectFile(new File(['proof'], 'proof.pdf', { type: 'application/pdf' }))
    );

    expect(snackbarMock.openErrorSnackbar).not.toHaveBeenCalled();
  });
});
