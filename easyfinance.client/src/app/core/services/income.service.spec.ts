import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IncomeService } from './income.service';
import { SUPPRESS_SUCCESS_NOTIFICATION } from '../interceptor/http-request-interceptor';
import { UploadState } from '../types/upload-state';
import { Attachment } from '../models/attachment';

describe('IncomeService HTTP context', () => {
  let service: IncomeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IncomeService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(IncomeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('remove', () => {
    it('should suppress the delete-success interceptor notification', () => {
      service.remove('proj-1', 'income-1').subscribe();

      const req = httpMock.expectOne('/api/projects/proj-1/incomes/income-1');
      expect(req.request.method).toBe('DELETE');
      // Fails until SUPPRESS_SUCCESS_NOTIFICATION context is added to the call
      expect(req.request.context.get(SUPPRESS_SUCCESS_NOTIFICATION)).toBeTrue();

      req.flush(null, { status: 200, statusText: 'OK' });
    });
  });

  describe('attachments', () => {
    it('should upload a temporary attachment with only the file field and suppress the created notification', () => {
      const file = new File(['payslip-content'], 'payslip.pdf', { type: 'application/pdf' });

      service.uploadTemporaryAttachmentWithProgress('proj-1', file).subscribe();

      const req = httpMock.expectOne('/api/projects/proj-1/incomes/temporary-attachments');
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(SUPPRESS_SUCCESS_NOTIFICATION)).toBeTrue();

      const body = req.request.body as FormData;
      expect(body.get('file')).toBe(file);
      expect(body.get('attachmentType')).toBeNull();

      req.flush({ id: 'att-1' });
    });

    it('should report upload progress for a temporary attachment', () => {
      const file = new File(['0123456789'], 'payslip.pdf', { type: 'application/pdf' });
      const states: UploadState<Attachment>[] = [];

      service.uploadTemporaryAttachmentWithProgress('proj-1', file).subscribe(state => states.push(state));

      const req = httpMock.expectOne('/api/projects/proj-1/incomes/temporary-attachments');
      req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
      req.flush({ id: 'att-1' });

      expect(states[0].kind).toBe('progress');
      expect(states[1].kind).toBe('done');

      const progress = states[0] as { kind: 'progress'; percent: number };
      const done = states[1] as { kind: 'done'; body: { id: string } };
      expect(progress.percent).toBe(50);
      expect(done.body.id).toBe('att-1');
    });

    it('should delete an attachment and suppress the delete-success notification', () => {
      service.removeAttachment('proj-1', 'income-1', 'att-1').subscribe();

      const req = httpMock.expectOne('/api/projects/proj-1/incomes/income-1/attachments/att-1');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.context.get(SUPPRESS_SUCCESS_NOTIFICATION)).toBeTrue();

      req.flush(null, { status: 200, statusText: 'OK' });
    });

    it('should build the attachment download url', () => {
      expect(service.getAttachmentDownloadUrl('proj-1', 'income-1', 'att-1'))
        .toBe('/api/projects/proj-1/incomes/income-1/attachments/att-1');
    });
  });
});
