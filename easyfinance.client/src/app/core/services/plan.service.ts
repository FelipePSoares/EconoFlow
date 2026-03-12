import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Operation } from 'fast-json-patch';
import { map, Observable } from 'rxjs';
import { PlanEntry, PlanEntryRequest } from '../models/plan-entry';
import { Plan, PlanRequest } from '../models/plan';

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  constructor(private http: HttpClient) { }

  getPlans(projectId: string): Observable<Plan[]> {
    return this.http.get<Plan[]>('/api/projects/' + projectId + '/plans', {
      observe: 'body',
      responseType: 'json'
    });
  }

  createPlan(projectId: string, request: PlanRequest): Observable<Plan> {
    return this.http.post<Plan>('/api/projects/' + projectId + '/plans', request, {
      observe: 'body',
      responseType: 'json'
    });
  }

  updatePlan(projectId: string, planId: string, patch: Operation[]): Observable<Plan> {
    return this.http.patch<Plan>('/api/projects/' + projectId + '/plans/' + planId, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  archivePlan(projectId: string, planId: string): Observable<boolean> {
    return this.http.put('/api/projects/' + projectId + '/plans/' + planId + '/archive', {}, {
      observe: 'response'
    }).pipe(map(response => response.ok));
  }

  getEntries(projectId: string, planId: string): Observable<PlanEntry[]> {
    return this.http.get<PlanEntry[]>('/api/projects/' + projectId + '/plans/' + planId + '/entries', {
      observe: 'body',
      responseType: 'json'
    });
  }

  addEntry(projectId: string, planId: string, request: PlanEntryRequest): Observable<PlanEntry> {
    return this.http.post<PlanEntry>('/api/projects/' + projectId + '/plans/' + planId + '/entries', request, {
      observe: 'body',
      responseType: 'json'
    });
  }
}
