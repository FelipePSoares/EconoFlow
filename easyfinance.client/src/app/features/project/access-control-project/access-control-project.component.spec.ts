import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AccessControlProjectComponent } from './access-control-project.component';
import { GlobalService } from '../../../core/services/global.service';
import { LocalService } from '../../../core/services/local.service';
import { UserService } from '../../../core/services/user.service';
import { Role } from '../../../core/enums/Role';
import { Project } from '../../../core/models/project';
import { UserProject } from '../../../core/models/user-project';

describe('AccessControlProjectComponent - remove user', () => {
  const projectId = 'project-1';
  const userProjectId = 'membership-1';
  const otherMembershipId = 'membership-2';

  let fixture: ComponentFixture<AccessControlProjectComponent>;
  let component: AccessControlProjectComponent;
  let httpMock: HttpTestingController;

  const buildUserProject = (id: string, email: string): UserProject => ({
    id,
    userId: 'user-' + id,
    project: { id: projectId, name: 'Project One', preferredCurrency: 'EUR' } as Project,
    userName: 'Jane Doe',
    userEmail: email,
    role: Role.Viewer,
    accepted: true
  } as UserProject);

  const loadUsers = (): void => {
    httpMock.expectOne('/api/projects/' + projectId + '/users')
      .flush([
        buildUserProject(userProjectId, 'jane@econoflow.test'),
        buildUserProject(otherMembershipId, 'john@econoflow.test')
      ]);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AccessControlProjectComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: LocalService, useValue: { getData: () => of(undefined), saveData: () => of(undefined), removeData: () => undefined } },
        { provide: UserService, useValue: { searchUser: () => of([]) } },
        { provide: GlobalService, useValue: {} }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(AccessControlProjectComponent);
    component = fixture.componentInstance;
    component.projectId = projectId;
    fixture.detectChanges();

    loadUsers();
  });

  afterEach(() => httpMock.verify());

  it('should delete the clicked membership instead of the signed in user', () => {
    // The remove action is bound to userProject.id in the template. Passing the user id instead
    // would target the wrong row, so assert the request carries the rendered membership id.
    const removeButtons = fixture.nativeElement.querySelectorAll('.delete-btn') as NodeListOf<HTMLButtonElement>;
    expect(removeButtons.length).withContext('one remove action per listed member').toBe(2);

    removeButtons[1].click();

    const deleteRequest = httpMock.expectOne('/api/projects/' + projectId + '/access/' + otherMembershipId);
    expect(deleteRequest.request.method).toBe('DELETE');
    expect(deleteRequest.request.url).not.toContain(userProjectId);

    deleteRequest.flush(null, { status: 200, statusText: 'OK' });

    httpMock.expectOne('/api/projects/' + projectId + '/users').flush([]);
  });

  it('should scope the deletion to the component project and reload the user list', () => {
    // The backend scopes the deletion by project id, so the project input must be forwarded;
    // without it the request becomes a silent no-op.
    component.removeUser(userProjectId);

    const deleteRequest = httpMock.expectOne('/api/projects/' + projectId + '/access/' + userProjectId);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null, { status: 200, statusText: 'OK' });

    httpMock.expectOne('/api/projects/' + projectId + '/users').flush([]);
  });
});
