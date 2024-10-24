import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input, ViewChild } from '@angular/core';
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

@Component({
  selector: 'app-list-categories',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule,
    ConfirmDialogComponent,
    AddButtonComponent,
    ReturnButtonComponent,
    CurrentDateComponent,
  ],
  templateUrl: './list-categories.component.html',
  styleUrl: './list-categories.component.css'
})
export class ListCategoriesComponent {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  faPenToSquare = faPenToSquare;
  faBoxArchive = faBoxArchive;
  faFloppyDisk = faFloppyDisk;
  private _currentDate!: Date;
  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();
  categoryForm!: FormGroup;
  editingCategory: CategoryDto = new CategoryDto();
  itemToDelete!: string;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
  projectId!: string;

  get currentDate(): Date {
    return this._currentDate;
  }
  @Input({ required: true })
  set currentDate(currentDate: Date) {
    this._currentDate = new Date(currentDate);
    this.categoryService.get(this.projectId, this._currentDate)
      .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
      .subscribe(
        {
          next: res => { this.categories.next(res); }
        });
  }

  constructor(public categoryService: CategoryService, private router: Router) {
    this.edit(new CategoryDto());
  }

  get id() {
    return this.categoryForm.get('id');
  }
  get name() {
    return this.categoryForm.get('name');
  }

  select(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', id, 'expenses', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  save(): void {
    if (this.categoryForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;

      var newCategory = <CategoryDto>({
        id: id,
        name: name,
        expenses: this.editingCategory.expenses
      })
      var patch = compare(this.editingCategory, newCategory);

      this.categoryService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingCategory.name = response.name;
          this.editingCategory = new CategoryDto();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  add() {
      this.router.navigate(['projects', this.projectId, 'add-category', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
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
          if (item.id === id) { categoriesNewArray.splice(index, 1); }
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
    this.currentDate = newDate;
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  getPercentageWaste(waste: number, budget: number): number {
    return budget === 0 ? 0 : waste * 100 / budget;
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

    return 'Overspend';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }
}
