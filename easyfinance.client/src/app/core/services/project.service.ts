import { inject, Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
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
import { ProjectTaxYearSettings, ProjectTaxYearSettingsRequest } from '../models/project-tax-year-settings';
import { TaxYearPeriod } from '../models/tax-year-period';
import { DeductibleGroup } from '../models/deductible-group';
import { DeductibleGroupExpense } from '../models/deductible-group-expense';
import { DeductibleGroupTotals } from '../models/deductible-group-totals';
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

  upsertTaxYearSettings(id: string, settings: ProjectTaxYearSettingsRequest): Observable<ProjectTaxYearSettings> {
    return this.http.put<ProjectTaxYearSettings>('/api/projects/' + id + '/settings/tax-year', settings, {
      observe: 'body',
      responseType: 'json'
    });
  }

  getTaxYearSettings(id: string): Observable<ProjectTaxYearSettings> {
    return this.http.get<ProjectTaxYearSettings>('/api/projects/' + id + '/settings/tax-year', {
      observe: 'body',
      responseType: 'json'
    });
  }

  getTaxYears(id: string): Observable<TaxYearPeriod[]> {
    return this.http.get<TaxYearPeriod[]>('/api/projects/' + id + '/tax-years', {
      observe: 'body',
      responseType: 'json'
    });
  }

  getDeductibleGroups(id: string, taxYearId: string): Observable<DeductibleGroup[]> {
    return this.http.get<DeductibleGroup[]>('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups', {
      observe: 'body',
      responseType: 'json'
    });
  }

  createDeductibleGroup(id: string, taxYearId: string, name: string): Observable<DeductibleGroup> {
    return this.http.post<DeductibleGroup>('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups', {
      name
    }, {
      observe: 'body',
      responseType: 'json'
    });
  }

  updateDeductibleGroup(id: string, taxYearId: string, groupId: string, name: string): Observable<DeductibleGroup> {
    return this.http.put<DeductibleGroup>('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/' + groupId, {
      name
    }, {
      observe: 'body',
      responseType: 'json'
    });
  }

  deleteDeductibleGroup(id: string, taxYearId: string, groupId: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/' + groupId, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  getDeductibleGroupExpenses(id: string, taxYearId: string, groupId: string): Observable<DeductibleGroupExpense[]> {
    return this.http.get<DeductibleGroupExpense[]>('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/' + groupId + '/expenses', {
      observe: 'body',
      responseType: 'json'
    });
  }

  assignExpenseToDeductibleGroup(
    id: string,
    taxYearId: string,
    groupId: string,
    expenseId?: string | null,
    expenseItemId?: string | null
  ): Observable<boolean> {
    return this.http.post('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/' + groupId + '/expenses', {
      expenseId: expenseId ?? null,
      expenseItemId: expenseItemId ?? null
    }, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  removeExpenseFromDeductibleGroup(
    id: string,
    taxYearId: string,
    groupId: string,
    expenseId?: string | null,
    expenseItemId?: string | null
  ): Observable<boolean> {
    let params = new HttpParams();
    if (expenseId) {
      params = params.set('expenseId', expenseId);
    }

    if (expenseItemId) {
      params = params.set('expenseItemId', expenseItemId);
    }

    return this.http.delete('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/' + groupId + '/expenses', {
      params,
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  getDeductibleGroupTotals(id: string, taxYearId: string): Observable<DeductibleGroupTotals> {
    return this.http.get<DeductibleGroupTotals>('/api/projects/' + id + '/tax-years/' + encodeURIComponent(taxYearId) + '/deductible-groups/totals', {
      observe: 'body',
      responseType: 'json'
    });
  }
}
