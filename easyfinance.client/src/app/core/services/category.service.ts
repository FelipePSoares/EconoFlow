import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { Category } from '../models/category';
import { dateUTC, formatDate } from '../utils/date';
import { DefaultCategory } from '../models/default-category';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor(private http: HttpClient) { }

  get(projectId: string, currentDate?: Date) {
    const year = currentDate?.getFullYear() ?? -1;
    const month = currentDate?.getMonth() ?? -1;

    let queryParams = new HttpParams();

    if (year >= 0 && month >= 0) {
      queryParams = queryParams.append("from", formatDate(dateUTC(year, month)).substring(0, 10));
      queryParams = queryParams.append("to", formatDate(dateUTC(year, month + 1)).substring(0, 10));
    }

    return this.http.get<Category[]>('/api/projects/' + projectId + '/categories', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  getById(projectId: string, categoryId: string): Observable<Category> {
    return this.http.get<Category>('/api/projects/' + projectId + '/categories/' + categoryId, {
      observe: 'body',
      responseType: 'json'
    })
  }

  getDefaultCategories(projectId: string): Observable<DefaultCategory[]> {
    return this.http.get<DefaultCategory[]>('/api/projects/' + projectId + '/categories/DefaultCategories', {
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
    return this.http.put('/api/projects/' + projectId + '/categories/' + id + '/archive', {}, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
