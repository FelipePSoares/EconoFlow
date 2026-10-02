/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { MAT_MOMENT_DATE_FORMATS, provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { TranslateModule } from '@ngx-translate/core';
import { AddIncomeComponent } from './add-income.component';
import { IncomeService } from '../../../core/services/income.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { Attachment } from '../../../core/models/attachment';
import { AttachmentType } from '../../../core/enums/attachment-type';
import { IncomeDto } from '../models/income-dto';

describe('AddIncomeComponent attachments', () => {
  let fixture: ComponentFixture<AddIncomeComponent>;
  let component: AddIncomeComponent;
  let incomeServiceMock: jasmine.SpyObj<IncomeService>;
  let snackbarMock: jasmine.SpyObj<SnackbarComponent>;

  const buildAttachment = (id: string, name: string, isTemporary = false): Attachment => ({
    id,
    name,
    contentType: 'application/pdf',
    size: 1024,
    attachmentType: AttachmentType.General,
    isTemporary
  });

  beforeEach(async () => {
    incomeServiceMock = jasmine.createSpyObj<IncomeService>('IncomeService', [
      'add',
      'update',
      'uploadTemporaryAttachmentWithProgress',
      'removeAttachment',
      'getAttachmentDownloadUrl'
    ]);

    incomeServiceMock.add.and.returnValue(of({
      id: 'income-created',
      name: 'Salary',
      date: new Date('2026-03-01T00:00:00Z'),
      amount: 100,
      attachments: [],
      temporaryAttachmentIds: []
    } as any));
    incomeServiceMock.update.and.returnValue(of({
      id: 'income-1',
      name: 'Salary',
      date: new Date('2026-03-01T00:00:00Z'),
      amount: 100,
      attachments: [],
      temporaryAttachmentIds: []
    } as any));
    incomeServiceMock.uploadTemporaryAttachmentWithProgress.and.returnValues(
      of({
        type: HttpEventType.Response,
        body: buildAttachment('temp-1', 'payslip-1.pdf', true)
      } as any),
      of({
        type: HttpEventType.Response,
        body: buildAttachment('temp-2', 'payslip-2.pdf', true)
      } as any)
    );
    incomeServiceMock.removeAttachment.and.returnValue(of(true));
    incomeServiceMock.getAttachmentDownloadUrl.and.returnValue('/api/mock/income-attachment');

    snackbarMock = jasmine.createSpyObj<SnackbarComponent>('SnackbarComponent', [
      'openSuccessSnackbar',
      'openErrorSnackbar'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        AddIncomeComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        provideMomentDateAdapter(MAT_MOMENT_DATE_FORMATS, { useUtc: true }),
        {
          provide: IncomeService,
          useValue: incomeServiceMock
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
          useValue: snackbarMock
        }
      ]
    }).compileComponents();
  });

  const createIncome = (attachments: Attachment[]): IncomeDto => {
    const income = new IncomeDto();
    income.id = 'income-1';
    income.name = 'Salary';
    income.date = new Date('2026-03-01T00:00:00Z');
    income.amount = 2500;
    income.attachments = attachments;
    income.temporaryAttachmentIds = [];
    return income;
  };

  const setupComponent = (income?: IncomeDto): void => {
    fixture = TestBed.createComponent(AddIncomeComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.income = income;
    fixture.detectChanges();
  };

  const selectFiles = (...files: File[]): Event => {
    const inputElement = document.createElement('input');
    Object.defineProperty(inputElement, 'files', {
      value: files,
      configurable: true
    });
    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', {
      value: inputElement,
      configurable: true
    });
    return changeEvent;
  };

  it('should render existing attachments when editing an income', () => {
    setupComponent(createIncome([buildAttachment('att-1', 'payslip-january.pdf')]));

    const existing = fixture.nativeElement.querySelector('[data-testid="income-attachment-existing"]');
    expect(existing).not.toBeNull();
    expect(existing.textContent).toContain('payslip-january.pdf');
    expect(fixture.nativeElement.querySelector('[data-testid="income-attachment-download-link"]')).not.toBeNull();
  });

  it('should render no existing attachments for a new income', () => {
    setupComponent();

    expect(fixture.nativeElement.querySelector('[data-testid="income-attachment-existing"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="income-attachments-input"]')).not.toBeNull();
  });

  it('should upload every selected file as a temporary attachment', async () => {
    setupComponent();

    const first = new File(['first'], 'payslip-1.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'payslip-2.pdf', { type: 'application/pdf' });

    await component.onAttachmentsSelected(selectFiles(first, second));

    expect(incomeServiceMock.uploadTemporaryAttachmentWithProgress).toHaveBeenCalledWith('project-1', first);
    expect(incomeServiceMock.uploadTemporaryAttachmentWithProgress).toHaveBeenCalledWith('project-1', second);
    expect(component.pendingAttachments.map(attachment => attachment.id)).toEqual(['temp-1', 'temp-2']);
  });

  it('should reject an unsupported file type without uploading', async () => {
    setupComponent();

    const file = new File(['plain'], 'notes.txt', { type: 'text/plain' });

    await component.onAttachmentsSelected(selectFiles(file));

    expect(incomeServiceMock.uploadTemporaryAttachmentWithProgress).not.toHaveBeenCalled();
    expect(component.pendingAttachments).toEqual([]);
    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalledWith('IncomeAttachmentInvalidFileType');
  });

  it('should reject a file larger than the maximum allowed size without uploading', async () => {
    setupComponent();

    const oversized = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 11 * 1024 * 1024, configurable: true });

    await component.onAttachmentsSelected(selectFiles(oversized));

    expect(incomeServiceMock.uploadTemporaryAttachmentWithProgress).not.toHaveBeenCalled();
    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalledWith('IncomeAttachmentFileSizeExceeded');
  });

  it('should report the unsupported type when a file is both unsupported and oversized', async () => {
    setupComponent();

    const file = new File(['x'], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024, configurable: true });

    await component.onAttachmentsSelected(selectFiles(file));

    expect(snackbarMock.openErrorSnackbar).toHaveBeenCalledWith('IncomeAttachmentInvalidFileType');
    expect(snackbarMock.openErrorSnackbar).not.toHaveBeenCalledWith('IncomeAttachmentFileSizeExceeded');
  });

  it('should send temporary attachment ids when creating an income', () => {
    setupComponent();
    component.incomeForm.get('name')?.setValue('Salary');
    component.incomeForm.get('amount')?.setValue(2500);
    component.pendingAttachments = [buildAttachment('temp-1', 'payslip.pdf', true)];

    component.saveIncome();

    const [projectId, payload] = incomeServiceMock.add.calls.mostRecent().args;
    expect(projectId).toBe('project-1');
    expect(payload.temporaryAttachmentIds).toEqual(['temp-1']);
  });

  it('should patch temporary attachment ids when editing an income', () => {
    setupComponent(createIncome([]));
    component.incomeForm.get('name')?.setValue('Salary');
    component.pendingAttachments = [buildAttachment('temp-1', 'payslip.pdf', true)];

    component.saveIncome();

    const [, , patch] = incomeServiceMock.update.calls.mostRecent().args;
    expect(patch.some(operation => operation.path.startsWith('/temporaryAttachmentIds'))).toBeTrue();
  });

  it('should delete an existing attachment through the service', () => {
    setupComponent(createIncome([buildAttachment('att-1', 'payslip-january.pdf')]));
    const attachment = component.attachments[0];

    component.removeAttachment(attachment);
    fixture.detectChanges();

    expect(incomeServiceMock.removeAttachment).toHaveBeenCalledWith('project-1', 'income-1', 'att-1');
    expect(component.attachments).toEqual([]);
  });

  it('should drop a pending attachment without calling the service', () => {
    setupComponent();
    const pending = buildAttachment('temp-1', 'payslip.pdf', true);
    component.pendingAttachments = [pending];
    fixture.detectChanges();

    component.removeAttachment(pending);
    fixture.detectChanges();

    expect(incomeServiceMock.removeAttachment).not.toHaveBeenCalled();
    expect(component.pendingAttachments).toEqual([]);
  });

  it('should disable submit while an attachment upload is in progress', () => {
    setupComponent(createIncome([]));
    component.incomeForm.get('name')?.setValue('Salary');
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(submitButton.disabled).toBeFalse();

    component.isAttachmentOperationInProgress = true;
    fixture.detectChanges();

    expect(submitButton.disabled).toBeTrue();
  });
});
