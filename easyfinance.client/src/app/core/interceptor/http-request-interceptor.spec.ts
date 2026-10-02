import { HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';
import { AuthService } from '../services/auth.service';
import { HttpRequestInterceptor, SUPPRESS_SUCCESS_NOTIFICATION } from './http-request-interceptor';

describe('HttpRequestInterceptor success notifications', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let snackbarMock: jasmine.SpyObj<SnackbarComponent>;

  beforeEach(() => {
    snackbarMock = jasmine.createSpyObj<SnackbarComponent>('SnackbarComponent', [
      'openSuccessSnackbar',
      'openErrorSnackbar'
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([HttpRequestInterceptor])),
        provideHttpClientTesting(),
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key }
        },
        {
          provide: SnackbarComponent,
          useValue: snackbarMock
        },
        {
          provide: MatDialog,
          useValue: { closeAll: () => undefined }
        },
        {
          provide: Router,
          useValue: { url: '/', navigate: () => undefined }
        },
        {
          provide: AuthService,
          useValue: { signOut: () => undefined, refreshToken: () => of(true) }
        }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should show the created notification for a 201 response', () => {
    http.post('/api/things', {}).subscribe();

    httpMock.expectOne('/api/things').flush({}, { status: 201, statusText: 'Created' });

    expect(snackbarMock.openSuccessSnackbar).toHaveBeenCalledWith('CreatedSuccess');
  });

  it('should not show the created notification when the request suppresses it', () => {
    http.post('/api/things', {}, {
      context: new HttpContext().set(SUPPRESS_SUCCESS_NOTIFICATION, true)
    }).subscribe();

    httpMock.expectOne('/api/things').flush({}, { status: 201, statusText: 'Created' });

    expect(snackbarMock.openSuccessSnackbar).not.toHaveBeenCalled();
  });

  it('should show the deleted notification for a DELETE response', () => {
    http.delete('/api/things/1').subscribe();

    httpMock.expectOne('/api/things/1').flush(null, { status: 200, statusText: 'OK' });

    expect(snackbarMock.openSuccessSnackbar).toHaveBeenCalledWith('DeletedSuccess');
  });

  it('should not show the deleted notification when the request suppresses it', () => {
    http.delete('/api/things/1', {
      context: new HttpContext().set(SUPPRESS_SUCCESS_NOTIFICATION, true)
    }).subscribe();

    httpMock.expectOne('/api/things/1').flush(null, { status: 200, statusText: 'OK' });

    expect(snackbarMock.openSuccessSnackbar).not.toHaveBeenCalled();
  });
});
