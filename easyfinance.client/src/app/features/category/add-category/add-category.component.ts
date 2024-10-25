import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CategoryService } from '../../../core/services/category.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryDto } from '../models/category-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ReturnButtonComponent,
    MatButtonModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './add-category.component.html',
  styleUrl: './add-category.component.css'
})
export class AddCategoryComponent implements OnInit {
  private currentDate!: Date;
  categoryForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

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
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.categoryForm = new FormGroup({
      name: new FormControl('', [Validators.required])
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
          this.previous(); 
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
    const control = this.categoryForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            default:
              errors.push(control.errors[key]);
          }
        }
      }
    }

    return errors;
  }

  get name() {
    return this.categoryForm.get('name');
  }

  trackByFn(index: number, item: string): number {
    return index;
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, 'categories', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
