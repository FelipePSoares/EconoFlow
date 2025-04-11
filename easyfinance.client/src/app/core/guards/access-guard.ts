import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ProjectTypes } from '../enums/project-types';
import { ProjectService } from '../services/project.service';

@Injectable({
  providedIn: 'root'
})
export class AccessGuard implements CanActivate {

  constructor(
    private projectService: ProjectService,
    private router: Router) { }

  canActivate() {
    return this.projectService.getSelectedUserProject()?.project.type == ProjectTypes.Company;
  }
}
