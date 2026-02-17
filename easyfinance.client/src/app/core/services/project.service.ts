import { inject, Injectable } from '@angular/core';
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
import { formatDate } from '../utils/date';
import { CurrentDateService } from './current-date.service';
import { GlobalService } from './global.service';
import { AnnualCategorySummary, AnnualCategorySummaryDto } from '../../features/project/models/annual-category-summary-dto';
const PROJECT_DATA = "project_data";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private http = inject(HttpClient);
  private localService = inject(LocalService);
  private userService = inject(UserService);
  private currentDateService = inject(CurrentDateService);
  private globalService = inject(GlobalService);

  private editingProject!: ProjectDto;
  private selectedProjectSubject = new BehaviorSubject<UserProject | undefined>(undefined);
  selectedUserProject$ = this.selectedProjectSubject.asObservable();

  constructor() {
    this.localService.getData<UserProject>(PROJECT_DATA)
      .subscribe(currentProject => {
        this.globalService.currency = currentProject?.project.preferredCurrency ?? 'EUR';
        this.selectedProjectSubject.next(currentProject)
      });
  }

  getUserProjects(): Observable<UserProject[]> {
    this.currentDateService.resetDateToday();
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

  getAnnualExpensesByCategory(id: string, year: number): Observable<AnnualCategorySummary[]> {
    return this.http.get<{ Name: string, Amount: number }[]>('/api/projects/' + id + '/overview/annual/' + year + '/expenses-by-category', {
      observe: 'body',
      responseType: 'json'
    }).pipe(map(response => AnnualCategorySummaryDto.fromApiList(response)));
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
    this.localService.saveData(PROJECT_DATA, userProject).subscribe();
    this.globalService.currency = userProject?.project.preferredCurrency ?? 'EUR';
    this.selectedProjectSubject.next(userProject);
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

  getMonthlyExpenses(id: string, monthsBack: number): Observable<{ month: string, amount: number }[]> {
    return this.http.get<{ month: string, amount: number }[]>('/api/projects/' + id + '/monthly-expenses/' + monthsBack, {
      observe: 'body',
      responseType: 'json'
    });
  }
}
