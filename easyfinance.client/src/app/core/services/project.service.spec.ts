import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { GlobalService } from './global.service';
import { LocalService } from './local.service';
import { UserService } from './user.service';
import { of } from 'rxjs';

describe('ProjectService - access removal request', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: LocalService, useValue: { getData: () => of(undefined), saveData: () => of(undefined), removeData: () => undefined } },
        { provide: UserService, useValue: {} },
        { provide: GlobalService, useValue: {} }
      ]
    });

    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should send both the project id and the membership id when removing access', () => {
    // The backend scopes the deletion by project id, so the project id must be part of the
    // request path - otherwise the call becomes a silent no-op.
    service.removeUser('project-1', 'membership-1').subscribe();

    const req = httpMock.expectOne('/api/projects/project-1/access/membership-1');
    expect(req.request.method).toBe('DELETE');

    req.flush(null, { status: 200, statusText: 'OK' });
  });
});
