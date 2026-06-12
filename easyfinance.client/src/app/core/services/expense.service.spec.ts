import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpenseService } from './expense.service';
import { SUPPRESS_SUCCESS_NOTIFICATION } from '../interceptor/http-request-interceptor';

describe('ExpenseService HTTP context', () => {
  let service: ExpenseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('remove', () => {
    it('should suppress the delete-success interceptor notification', () => {
      service.remove('proj-1', 'cat-1', 'exp-1').subscribe();

      const req = httpMock.expectOne('/api/projects/proj-1/categories/cat-1/expenses/exp-1');
      expect(req.request.method).toBe('DELETE');
      // Fails until SUPPRESS_SUCCESS_NOTIFICATION context is added to the call
      expect(req.request.context.get(SUPPRESS_SUCCESS_NOTIFICATION)).toBeTrue();

      req.flush(null, { status: 200, statusText: 'OK' });
    });
  });

  describe('removeItem', () => {
    it('should suppress the delete-success interceptor notification', () => {
      service.removeItem('proj-1', 'cat-1', 'exp-1', 'item-1').subscribe();

      const req = httpMock.expectOne(
        '/api/projects/proj-1/categories/cat-1/expenses/exp-1/expenseItems/item-1'
      );
      expect(req.request.method).toBe('DELETE');
      // Fails until SUPPRESS_SUCCESS_NOTIFICATION context is added to the call
      expect(req.request.context.get(SUPPRESS_SUCCESS_NOTIFICATION)).toBeTrue();

      req.flush(null, { status: 200, statusText: 'OK' });
    });
  });
});
