import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, map, combineLatest } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatButton } from "@angular/material/button";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CategoryDto } from '../models/category-dto';
import { CategoryService } from '../../../core/services/category.service';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';
import { startWith } from 'rxjs/operators';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { DefaultCategory } from '../../../core/models/default-category';

@Component({
    selector: 'app-list-categories',
    imports: [
      CommonModule,
      AsyncPipe,
      ReactiveFormsModule,
      MatButton,
      MatError,
      MatFormField,
      MatInput,
      MatLabel,
      MatAutocompleteModule,
      DragDropModule,
      TranslateModule
    ],
    templateUrl: './list-categories.component.html',
    styleUrl: './list-categories.component.css'
})
export class ListCategoriesComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();

  private defaultCategories: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  defaultCategories$: Observable<string[]> = this.defaultCategories.asObservable();

  filteredCategories$: Observable<string[]> = new Observable<string[]>();

  categoryForm!: FormGroup;
  editingCategory: CategoryDto = new CategoryDto();
  itemToDelete!: string;
  httpErrors = false;
  errors!: Record<string, string[]>;
  userProject!: UserProjectDto;
  isSavingOrder = false;

  @Input({ required: true })
  projectId!: string;

  constructor(
    public categoryService: CategoryService,
    private route: ActivatedRoute,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private dialog: MatDialog,
    private projectService: ProjectService,
    private translateService: TranslateService
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

    this.categoryService.getDefaultCategories(this.projectId).subscribe({
      next: (categories) => {
        const categoryNames = categories.map((category: DefaultCategory) => category.name);
        this.defaultCategories.next(categoryNames);
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
      }
    });

    this.edit(new CategoryDto());
    this.fillData();
  }

  fillData() {
    this.categoryService.get(this.projectId)
      .pipe(map(categories => CategoryDto.fromCategories(categories)))
      .subscribe(
        {
          next: res => {
            this.categories.next(this.sortCategories(res));
          }
        });
  }

  get id() {
    return this.categoryForm.get('id');
  }

  get name() {
    return this.categoryForm.get('name');
  }

  save(): void {
    if (this.categoryForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;

      const newCategory = ({
        id: id,
        name: name,
        expenses: this.editingCategory.expenses,
        isArchived: this.editingCategory.isArchived,
        displayOrder: this.editingCategory.displayOrder
      }) as CategoryDto;
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
  }

  private filterCategories(value: string, categories: string[]): string[] {
    const filterValue = value.toLowerCase();
    return categories.filter(category =>
      category.toLowerCase().includes(filterValue)
    );
  }

  edit(category: CategoryDto): void {
    this.editingCategory = category;
    this.categoryForm = new FormGroup({
      id: new FormControl(category.id),
      name: new FormControl(category.name, [Validators.required, Validators.maxLength(100)])
    });

    this.filteredCategories$ = combineLatest([
      this.name!.valueChanges.pipe(startWith('')),
      this.defaultCategories$
    ]).pipe(
      map(([searchValue, categories]) => this.filterCategories(searchValue || '', categories))
    );
  }

  cancelEdit(): void {
    this.editingCategory = new CategoryDto();
  }

  remove(id: string): void {
    this.categoryService.remove(this.projectId, id).subscribe({
      next: () => {
        const categoriesNewArray: CategoryDto[] = [...this.categories.getValue()];

        categoriesNewArray.forEach((item, index) => {
          if (item.id === id) {
            categoriesNewArray.splice(index, 1);
          }
        });

        this.categories.next(categoriesNewArray);
      }
    })
  }

  triggerDelete(category: CategoryDto): void {
    this.itemToDelete = category.id
    const message = this.translateService.instant('AreYouSureYouWantArchiveCategory', { value: category.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'ArchiveCategory', message: message, action: 'ButtonArchive' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.remove(this.itemToDelete);
      }
    });
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }

  drop(event: CdkDragDrop<CategoryDto[]>): void {
    if (!this.canAddOrEdit() || this.isSavingOrder || event.previousIndex === event.currentIndex) {
      return;
    }

    const reorderedCategories = [...this.categories.getValue()];
    moveItemInArray(reorderedCategories, event.previousIndex, event.currentIndex);

    const categoriesToUpdate = reorderedCategories
      .filter(category => !!category.id)
      .map((category, index) => ({ category, displayOrder: index }))
      .filter(item => item.category.displayOrder !== item.displayOrder);

    if (!categoriesToUpdate.length) {
      this.categories.next(this.sortCategories(reorderedCategories));
      return;
    }

    categoriesToUpdate.forEach(item => {
      item.category.displayOrder = item.displayOrder;
    });

    this.categories.next(this.sortCategories(reorderedCategories));
    this.isSavingOrder = true;

    this.categoryService.updateOrder(
      this.projectId,
      reorderedCategories
        .filter(category => !!category.id)
        .map((category, index) => ({ categoryId: category.id, displayOrder: index }))
    ).subscribe({
      next: () => {
        this.isSavingOrder = false;
        this.fillData();
      },
      error: () => {
        this.isSavingOrder = false;
        this.fillData();
      }
    });
  }

  private sortCategories(categories: CategoryDto[]): CategoryDto[] {
    return [...categories].sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }

      return (left.name ?? '').localeCompare(right.name ?? '');
    });
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.categoryForm, fieldName);
  }
}
