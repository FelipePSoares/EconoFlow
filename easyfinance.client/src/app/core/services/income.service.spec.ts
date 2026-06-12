import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IncomeService } from './income.service';
import { SUPPRESS_SUCCESS_NOTIFICATION } from '../interceptor/http-request-interceptor';

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
});
