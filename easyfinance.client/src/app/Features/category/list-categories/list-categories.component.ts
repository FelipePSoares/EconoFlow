import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { mapper } from '../../../core/utils/mappings/mapper';
import { CategoryDto } from '../models/category-dto';
import { Category } from '../../../core/models/category';
import { CategoryService } from '../../../core/services/category.service';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-list-categories',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule
  ],
  templateUrl: './list-categories.component.html',
  styleUrl: './list-categories.component.css'
})
export class ListCategoriesComponent {
  private _currentDate!: Date;
  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();
  categoryForm!: FormGroup;
  editingCategory: CategoryDto = new CategoryDto();
  httpErrors = false;
  errors: any;
  faPlus = faPlus;
  
  get currentDate(): Date {
    return this._currentDate;
  }
  @Input({ required: true })
  set currentDate(currentDate: Date) {
    this._currentDate = currentDate;
    this.categoryService.get(this.projectId, this._currentDate)
      .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
      .subscribe(
        {
          next: res => { this.categories.next(res); }
        });
  }

  @Input({ required: true })
  projectId!: string;

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
}
