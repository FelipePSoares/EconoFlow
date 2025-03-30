import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../models/category-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { DefaultCategory } from '../../../core/models/default-category';

@Component({
    selector: 'app-add-category',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatAutocompleteModule,
        MatInputModule,
        MatFormFieldModule,
        TranslateModule
    ],
    templateUrl: './add-category.component.html',
    styleUrl: './add-category.component.css'
})
export class AddCategoryComponent implements OnInit {
  categoryForm!: FormGroup;
  httpErrors = false;
  errors!: Record<string, string[]>;

  @Input({ required: true }) projectId!: string;

  private defaultCategories: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  defaultCategories$: Observable<string[]> = this.defaultCategories.asObservable();
  
  filteredCategories$: Observable<string[]> = new Observable<string[]>();

  constructor(
    private categoryService: CategoryService,
    private router: Router,
    private route: ActivatedRoute,
    private errorMessageService: ErrorMessageService
  ) {}

  ngOnInit(): void {
    this.categoryForm = new FormGroup({
      name: new FormControl('', [Validators.required])
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

    this.filteredCategories$ = combineLatest([
      this.categoryForm.get('name')!.valueChanges.pipe(startWith('')),
      this.defaultCategories$
    ]).pipe(
      map(([searchValue, categories]) => this.filterCategories(searchValue || '', categories))
    );
  }

  private filterCategories(value: string, categories: string[]): string[] {
    const filterValue = value.toLowerCase();
    return categories.filter(category =>
      category.toLowerCase().includes(filterValue)
    );
  }

  save() {
    if (this.categoryForm.valid) {
      const name = this.name?.value;

      var newCategory = <CategoryDto>{ name: name };

      this.categoryService.add(this.projectId, newCategory).subscribe({
        next: response => {
          this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'categories'] } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;
          this.errorMessageService.setFormErrors(this.categoryForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.categoryForm, fieldName);
  }

  get name() {
    return this.categoryForm.get('name');
  }

  trackByFn(index: number, item: string): number {
    return index;
  }
}
