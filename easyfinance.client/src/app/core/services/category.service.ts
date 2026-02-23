import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { Category } from '../models/category';
import { formatDate } from '../utils/date';
import { DefaultCategory } from '../models/default-category';

export interface CategoryOrderRequest {
  categoryId: string;
  displayOrder: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor(private http: HttpClient) { }

  get(projectId: string, startOrCurrentDate?: Date, endDate?: Date) {
    let queryParams = new HttpParams();

    if (startOrCurrentDate && endDate) {
      queryParams = queryParams.append("from", formatDate(startOrCurrentDate).substring(0, 10));
      queryParams = queryParams.append("to", formatDate(endDate).substring(0, 10));
    } else if (startOrCurrentDate) {
      const year = startOrCurrentDate.getFullYear();
      const month = startOrCurrentDate.getMonth();
      queryParams = queryParams.append("from", formatDate(new Date(year, month, 1)).substring(0, 10));
      queryParams = queryParams.append("to", formatDate(new Date(year, month + 1, 1)).substring(0, 10));
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

  updateOrder(projectId: string, categoriesOrder: CategoryOrderRequest[]): Observable<boolean> {
    return this.http.put('/api/projects/' + projectId + '/categories/order', categoriesOrder, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  remove(projectId: string, id: string): Observable<boolean> {
    return this.http.put('/api/projects/' + projectId + '/categories/' + id + '/archive', {}, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
