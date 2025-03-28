import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable, map, combineLatest } from 'rxjs';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faBoxArchive, faFloppyDisk, faPlus } from '@fortawesome/free-solid-svg-icons';
import { MatButton } from "@angular/material/button";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { mapper } from '../../../core/utils/mappings/mapper';
import { CategoryDto } from '../models/category-dto';
import { Category } from '../../../core/models/category';
import { CategoryService } from '../../../core/services/category.service';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';
import { startWith } from 'rxjs/operators';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

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
      MatLabel,
      MatAutocompleteModule,
      TranslateModule
    ],
    templateUrl: './list-categories.component.html',
    styleUrl: './list-categories.component.css'
})
export class ListCategoriesComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  faPenToSquare = faPenToSquare;
  faBoxArchive = faBoxArchive;
  faFloppyDisk = faFloppyDisk;
  faPlus = faPlus;

  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();

  private defaultCategories: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  defaultCategories$: Observable<string[]> = this.defaultCategories.asObservable();

  filteredCategories$: Observable<string[]> = new Observable<string[]>();

  categoryForm!: FormGroup;
  editingCategory: CategoryDto = new CategoryDto();
  itemToDelete!: string;
  httpErrors = false;
  errors!: { [key: string]: string };
  userProject!: UserProjectDto;

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
        const categoryNames = categories.map((category: any) => category.name);
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

  save(): void {
    if (this.categoryForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;

      const newCategory = ({
        id: id,
        name: name,
        expenses: this.editingCategory.expenses
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
      name: new FormControl(category.name, [Validators.required])
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

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.categoryForm, fieldName);
  }
}
