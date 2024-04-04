import { Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Operation } from 'fast-json-patch';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private http: HttpClient) {
  }

  getProjects() {
    return this.http.get<Project[]>('/api/project/', {
      observe: 'body',
      responseType: 'json'
    });
  }

  addProject(project: Project): Observable<Project> {
    return this.http.post<Project>('/api/project/', project, {
      observe: 'body',
      responseType: 'json'
    });
  }

  updateProject(id: string, patch: Operation[]): Observable<Project> {
    return this.http.patch<Project>('/api/project/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  removeProject(id: string): Observable<boolean> {
    return this.http.delete('/api/project/' + id, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
