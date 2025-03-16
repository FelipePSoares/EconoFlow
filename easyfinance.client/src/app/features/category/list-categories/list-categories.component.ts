import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { mapper } from '../../../core/utils/mappings/mapper';
import { CategoryDto } from '../models/category-dto';
import { Category } from '../../../core/models/category';
import { CategoryService } from '../../../core/services/category.service';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faBoxArchive, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { MatButton } from "@angular/material/button";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';

@Component({
    selector: 'app-list-categories',
    imports: [
        CommonModule,
        AsyncPipe,
        ReactiveFormsModule,
        FontAwesomeModule,
        ConfirmDialogComponent,
        AddButtonComponent,
        ReturnButtonComponent,
        CurrentDateComponent,
        CurrencyFormatPipe,
        MatButton,
        MatError,
        MatFormField,
        MatInput,
        MatLabel
    ],
    templateUrl: './list-categories.component.html',
    styleUrl: './list-categories.component.css'
})
export class ListCategoriesComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  faPenToSquare = faPenToSquare;
  faBoxArchive = faBoxArchive;
  faFloppyDisk = faFloppyDisk;
  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();
  categoryForm!: FormGroup;
  editingCategory: CategoryDto = new CategoryDto();
  itemToDelete!: string;
  httpErrors = false;
  errors: any;
  userProject!: UserProjectDto;

  @Input({ required: true })
  projectId!: string;

  constructor(
    public categoryService: CategoryService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private dialog: MatDialog,
    private projectService: ProjectService
  ) {
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      if (userProject) {
        this.userProject = userProject;
      } else {
        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      }
    });

    this.edit(new CategoryDto());
    this.fillData(CurrentDateComponent.currentDate);
  }

  fillData(date: Date) {
    this.categoryService.get(this.projectId, date)
      .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
      .subscribe(
        {
          next: res => {
            this.categories.next(res);
          }
        });
  }

  get id() {
    return this.categoryForm.get('id');
  }

  get name() {
    return this.categoryForm.get('name');
  }

  select(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', id, 'expenses']);
  }

  save(): void {
    if (this.categoryForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;

      const newCategory = <CategoryDto>({
        id: id,
        name: name,
        expenses: this.editingCategory.expenses
      });
      const patch = compare(this.editingCategory, newCategory);

      this.categoryService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingCategory.name = response.name;
          this.editingCategory = new CategoryDto();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.categoryForm, this.errors);
        }
      });
    }
  }

  add() {
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'add-category'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: 'Create Category'
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData(CurrentDateComponent.currentDate);
      }
    });
  }

  edit(category: CategoryDto): void {
    this.editingCategory = category;
    this.categoryForm = new FormGroup({
      id: new FormControl(category.id),
      name: new FormControl(category.name, [Validators.required])
    });
  }

  cancelEdit(): void {
    this.editingCategory = new CategoryDto();
  }

  remove(id: string): void {
    this.categoryService.remove(this.projectId, id).subscribe({
      next: response => {
        const categoriesNewArray: CategoryDto[] = this.categories.getValue();

        categoriesNewArray.forEach((item, index) => {
          if (item.id === id) {
            categoriesNewArray.splice(index, 1);
          }
        });

        this.categories.next(categoriesNewArray);
      }
    })
  }

  triggerDelete(itemId: string): void {
    this.itemToDelete = itemId;
    this.ConfirmDialog.openModal('Archive Item', 'Are you sure you want to archive this item?', 'Archive');
  }

  handleConfirmation(result: boolean): void {
    if (result) {
      this.remove(this.itemToDelete);
    }
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId]);
  }

  getPercentageSpend(waste: number, budget: number): number {
    return budget === 0 ? waste !== 0 ? 101 : 0 : waste * 100 / budget;
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 75) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return 'Expenses';
    } else if (percentage <= 100) {
      return 'Risk of overspend';
    }

    return 'Overspend /';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.categoryForm, fieldName);
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }
}
