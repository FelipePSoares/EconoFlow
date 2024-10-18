import { Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { YearExpensesSummaryDto } from '../../Features/project/models/year-expenses-summary-dto';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private http: HttpClient) {
  }

  getProjects() {
    return this.http.get<Project[]>('/api/projects/', {
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
}
