import { Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { YearExpensesSummaryDto } from '../../features/project/models/year-expenses-summary-dto';
import { LocalService } from './local.service';
import { Transaction } from '../models/transaction';
import { ProjectDto } from '../../features/project/models/project-dto';
import { UserProject } from '../models/user-project';
import { UserService } from './user.service';
import { DefaultCategory } from '../models/default-category';
import { CurrentDateComponent } from '../components/current-date/current-date.component';
import { formatDate } from '../utils/date';
const PROJECT_DATA = "project_data";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private editingProject!: ProjectDto;
  private selectedProjectSubject = new BehaviorSubject<UserProject | undefined>(undefined);
  selectedUserProject$ = this.selectedProjectSubject.asObservable();

  constructor(private http: HttpClient, private localService: LocalService, private userService: UserService) {
  }

  getUserProjects(): Observable<UserProject[]> {
    CurrentDateComponent.resetDateToday();
    return this.http.get<UserProject[]>('/api/projects/', {
      observe: 'body',
      responseType: 'json'
    });
  }

  getUserProject(id: string): Observable<UserProject> {
    return this.http.get<UserProject>('/api/projects/' + id, {
      observe: 'body',
      responseType: 'json'
    });
  }

  addProject(project: Project): Observable<HttpResponse<UserProject>> {
    return this.http.post<UserProject>('/api/projects/', project, {
      observe: 'response'
    }).pipe(map(result => {
      this.userService.refreshUserInfo().subscribe();

      return result;
    }));
  }

  updateProject(id: string, patch: Operation[]): Observable<Project> {
    return this.http.patch<Project>('/api/projects/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  removeProject(id: string): Observable<boolean> {
    return this.http.put('/api/projects/' + id + '/archive', {}, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  getYearlyInfo(id: string, year: number) {
    return this.http.get<YearExpensesSummaryDto>('/api/projects/' + id + '/year-summary/' + year, {
      observe: 'body',
      responseType: 'json'
    });
  }

  copyBudgetPreviousMonth(id: string, currentDate: Date) {
    return this.http.post('/api/projects/' + id + '/copy-budget-previous-month/' + formatDate(currentDate), {}, {
      observe: 'body',
      responseType: 'json'
    });
  }

  acceptInvite(token: string) {
    return this.http.post('/api/projects/' + token + '/accept', null, {
      observe: 'body',
      responseType: 'json'
    });
  }

  selectUserProject(userProject: UserProject) {
    this.localService.saveData(PROJECT_DATA, userProject);
    this.selectedProjectSubject.next(userProject);
  }

  getSelectedUserProject(): UserProject | undefined {
    let currentProject = this.selectedProjectSubject.value;

    if (!currentProject) {
      const project = this.localService.getData<UserProject>(PROJECT_DATA);
      currentProject = project;
      this.selectedProjectSubject.next(currentProject);
    }

    return currentProject;
  }

  setEditingProject(project: ProjectDto) {
    this.editingProject = project;
  }

  getEditingProject(): ProjectDto {
    return this.editingProject ?? new ProjectDto();
  }

  getLatest(id: string, numberOfTransactions: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>('/api/projects/' + id + '/latests/' + numberOfTransactions, {
      observe: 'body',
      responseType: 'json',
    });
  }

  getProjectUsers(id: string): Observable<UserProject[]> {
    return this.http.get<UserProject[]>('/api/projects/' + id + '/users', {
      observe: 'body',
      responseType: 'json',
    })
  }

  updateAccess(id: string, patch: Operation[]): Observable<UserProject[]> {
    return this.http.patch<UserProject[]>('/api/projects/' + id + '/access', patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  removeUser(id: string, userProjectId: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + id + '/access/' + userProjectId, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  smartSetup(id: string, annualIncome: number, date: Date, defaultCategories: DefaultCategory[]): Observable<HttpResponse<unknown>> {
    return this.http.post('/api/projects/' + id + '/smart-setup/', {
      annualIncome: annualIncome,
      defaultCategories: defaultCategories,
      date: date.toISOString().split("T")[0]
    }, {
      observe: 'response'
    });
  }
}
