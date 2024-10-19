import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Income } from '../models/income';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { formatDate } from '../utils/date/date';

@Injectable({
  providedIn: 'root'
})
export class IncomeService {

  constructor(private http: HttpClient) { }
  
  get(projectId: string, currentDate: Date) {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();

    let queryParams = new HttpParams();
    queryParams = queryParams.append("from", formatDate(new Date(year, month)).substring(0, 10));
    queryParams = queryParams.append("to", formatDate(new Date(year, month + 1)).substring(0, 10));

    return this.http.get<Income[]>('/api/projects/' + projectId + '/incomes', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  add(projectId: string, income: Income): Observable<Income> {
    return this.http.post<Income>('/api/projects/' + projectId + '/incomes/', income, {
      observe: 'body',
      responseType: 'json'
    });
  }

  update(projectId: string, id: string, patch: Operation[]): Observable<Income> {
    return this.http.patch<Income>('/api/projects/' + projectId + '/incomes/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  remove(projectId: string, id: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/incomes/' + id, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
