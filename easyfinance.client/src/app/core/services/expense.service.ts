import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { Expense } from '../models/expense';
import { dateUTC, formatDate } from '../utils/date';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  constructor(private http: HttpClient) { }

  get(projectId: string, categoryId: string, currentDate: Date) {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();

    let queryParams = new HttpParams();
    queryParams = queryParams.append("from", formatDate(dateUTC(year, month)).substring(0, 10));
    queryParams = queryParams.append("to", formatDate(dateUTC(year, month + 1)).substring(0, 10));

    return this.http.get<Expense[]>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  getById(projectId: string, categoryId: string, expenseId: string) {
    return this.http.get<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId, {
      observe: 'body',
      responseType: 'json'
    });
  }

  add(projectId: string, categoryId: string, expense: Expense): Observable<Expense> {
    return this.http.post<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses', expense, {
      observe: 'body',
      responseType: 'json'
    });
  }

  update(projectId: string, categoryId: string, id: string, patch: Operation[]): Observable<Expense> {
    return this.http.patch<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  remove(projectId: string, categoryId: string, id: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + id, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  removeItem(projectId: string, categoryId: string, expenseId: string, expenseItemId: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/expenseItems/' + expenseItemId, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
