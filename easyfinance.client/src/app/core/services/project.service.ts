import { Injectable } from '@angular/core';
import { Project } from '../models/project';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { ProjectType } from '../enums/project-type';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private http: HttpClient) {
  }

  getProjects(): Observable<Project[]> {
    return of([
        <Project>({
          id: "23836aa6-e6f3-4bbf-81ab-27256eb611a9",
          name: "First Personal Project",
          type: ProjectType.Personal,
        }),
        <Project>({
          id: "dd4c24ee-1b3b-47d0-b6eb-1bd9b5e8a40e",
          name: "First Company Project",
          type: ProjectType.Company,
        })
      ]);
  }

  addProject(project: Project): Observable<Project>{
    return of(<Project>({ name: "teste update", type: ProjectType.Company }));
  }

  updateProject(patch: Operation[]): Observable<Project> {
    return of(<Project>({ name: "teste update", type: ProjectType.Company }));
  }

  removeProject(id: string): Observable<boolean>{
    return of(true);
  }
}
