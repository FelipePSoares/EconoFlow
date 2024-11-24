import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Category } from '../models/category';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { dateUTC, formatDate } from '../utils/date';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor(private http: HttpClient) { }

  get(projectId: string, currentDate: Date) {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();

    let queryParams = new HttpParams();
    queryParams = queryParams.append("from", formatDate(dateUTC(year, month)).substring(0, 10));
    queryParams = queryParams.append("to", formatDate(dateUTC(year, month + 1)).substring(0, 10));

    return this.http.get<Category[]>('/api/projects/' + projectId + '/categories', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  getDefaultCategories(projectId: string): Observable<Category[]> {
    return this.http.get<Category[]>('/api/projects/' + projectId + '/categories/DefaultCategories', {
      observe: 'body',
      responseType: 'json',
    });
  }

  add(projectId: string, category: Category): Observable<Category> {
    return this.http.post<Category>('/api/projects/' + projectId + '/categories/', category, {
      observe: 'body',
      responseType: 'json'
    });
  }

  update(projectId: string, id: string, patch: Operation[]): Observable<Category> {
    return this.http.patch<Category>('/api/projects/' + projectId + '/categories/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  remove(projectId: string, id: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + id, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
