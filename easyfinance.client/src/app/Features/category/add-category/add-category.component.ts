import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryDto } from '../models/category-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, ReturnButtonComponent],
  templateUrl: './add-category.component.html',
  styleUrl: './add-category.component.css'
})
export class AddCategoryComponent implements OnInit {
  private currentDate!: Date;
  categoryForm!: FormGroup;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
  projectId!: string;

  constructor(private categoryService: CategoryService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.categoryForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      goal: new FormControl('0', [Validators.pattern('[0-9]*')])
    });
  }

  save() {
    if (this.categoryForm.valid) {
      const name = this.name?.value;
      const goal = this.goal?.value;

      var newCategory = <CategoryDto>({
        name: name,
        goal: goal
      });

      this.categoryService.add(this.projectId, newCategory).subscribe({
        next: response => {
          this.previous();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  get name() {
    return this.categoryForm.get('name');
  }
  get goal() {
    return this.categoryForm.get('goal');
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
