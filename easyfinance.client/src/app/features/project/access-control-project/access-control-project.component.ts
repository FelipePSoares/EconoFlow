import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { mapper } from '../../../core/utils/mappings/mapper';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProjectService } from '../../../core/services/project.service';
import { UserProjectDto } from '../models/user-project-dto';
import { UserProject } from '../../../core/models/user-project';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { Role, Role2LabelMapping } from '../../../core/enums/Role';
import { UserService } from '../../../core/services/user.service';
import { Operation } from 'fast-json-patch';
import { ApiErrorResponse } from '../../../core/models/error';

@Component({
  selector: 'app-access-control-project',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './access-control-project.component.html',
  styleUrl: './access-control-project.component.css'
})
export class AccessControlProjectComponent implements OnInit {
  public role2LabelMapping = Role2LabelMapping;
  public roles = Object.values(Role) as Role[];
  accessForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

  @Input({ required: true }) projectId!: string;

  private currentUsers: BehaviorSubject<UserProjectDto[]> = new BehaviorSubject<UserProjectDto[]>([]);
  currentUsers$: Observable<UserProjectDto[]> = this.currentUsers.asObservable();

  private filteredUsers: BehaviorSubject<UserProjectDto[]> = new BehaviorSubject<UserProjectDto[]>([]);
  filteredUsers$: Observable<UserProjectDto[]> = this.filteredUsers.asObservable();

  constructor(private projectService: ProjectService, private userService: UserService, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.accessForm = new FormGroup({
      user: new FormControl<string | UserProjectDto>('', [Validators.required]),
      role: new FormControl('', [Validators.required])
    });

    this.user?.valueChanges.subscribe(value => this.searchUsers(value));

    this.updateCurrentUsers();
  }

  cleanForm(): void {
    this.accessForm.reset();
    Object.keys(this.accessForm.controls).forEach(key => {
      this.accessForm.controls[key].setErrors(null)
    });
  }

  updateCurrentUsers(): void {
    this.projectService.getProjectUsers(this.projectId)
      .pipe(map(users => mapper.mapArray(users, UserProject, UserProjectDto)))
      .subscribe({
      next: (users) => {
          this.currentUsers.next(users);
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
      }
    });
  }

  private searchUsers(searchTerm: string): void {
    this.userService.searchUser(searchTerm, this.projectId)
      .pipe(map(users => mapper.mapArray(users, UserProject, UserProjectDto)))
      .subscribe({
        next: (users) => {
          this.filteredUsers.next(users);
        },
        error: (error) => {
          console.error('Error fetching categories:', error);
        }
      });
  }

  addUser(): void {
    if (this.accessForm.valid) {
      let user = this.user?.value;
      let role = this.role?.value;

      var newUserProject = <UserProjectDto>({
        userId: user instanceof UserProjectDto ? user.userId : '',
        userEmail: user instanceof UserProjectDto ? '' : user,
        role: role
      });

      var patch = <Operation[]>[{ op: "add", path: "/-", value: newUserProject }];

      this.updateUsers(patch).subscribe({
        next: response => {
          this.currentUsers.next(response);
          this.cleanForm();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.accessForm, this.errors);
        }
      });
    }
  }

  private updateUsers(patch: Operation[]): Observable<UserProjectDto[]> {
    return this.projectService.updateAccess(this.projectId, patch);
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.accessForm, fieldName);
  }

  get user() {
    return this.accessForm.get('user');
  }

  get role() {
    return this.accessForm.get('role');
  }

  displayFn(user: UserProjectDto): string {
    return user && user.userName ? user.userName : '';
  }
}
