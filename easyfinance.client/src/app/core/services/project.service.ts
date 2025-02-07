import { Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { YearExpensesSummaryDto } from '../../features/project/models/year-expenses-summary-dto';
import { LocalService } from './local.service';
import { safeJsonParse } from '../utils/json-parser';
import { Transaction } from '../models/transaction';
const PROJECT_DATA = "project_data";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private selectedProjectSubject = new BehaviorSubject<any | null>(null);
  selectedProject$ = this.selectedProjectSubject.asObservable();

  constructor(private http: HttpClient, private localService: LocalService) {
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects/', {
      observe: 'body',
      responseType: 'json'
    });
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>('/api/projects/' + id, {
      observe: 'body',
      responseType: 'json'
    });
  }

  addProject(project: Project): Observable<Project> {
    return this.http.post<Project>('/api/projects/', project, {
      observe: 'body',
      responseType: 'json'
    });
  }

  updateProject(id: string, patch: Operation[]): Observable<Project> {
    return this.http.patch<Project>('/api/projects/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  removeProject(id: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + id, {
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
    return this.http.post('/api/projects/' + id + '/copy-budget-previous-month/', currentDate, {
      observe: 'body',
      responseType: 'json'
    });
  }

  selectProject(project: Project) {
    this.localService.saveData(PROJECT_DATA, JSON.stringify(project));
    this.selectedProjectSubject.next(project);
  }

  getSelectedProject(): Project | undefined {
    let currentProject = this.selectedProjectSubject.value;

    if (!currentProject) {
      let project = this.localService.getData(PROJECT_DATA);
      currentProject = safeJsonParse<Project>(project);
      this.selectedProjectSubject.next(currentProject);
    }

    return currentProject;
  }

  getLatest(id: string, numberOfTransactions: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>('/api/projects/' + id + '/latests/' + numberOfTransactions, {
      observe: 'body',
      responseType: 'json',
    });
  }
}
