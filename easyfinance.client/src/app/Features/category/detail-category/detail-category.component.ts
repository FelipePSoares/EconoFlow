import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ListExpensesComponent } from '../../expense/list-expenses/list-expenses.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';

@Component({
  selector: 'app-detail-category',
  standalone: true,
  imports: [
    ListExpensesComponent,
    CurrentDateComponent,
    AddButtonComponent,
    ReturnButtonComponent
  ],
  templateUrl: './detail-category.component.html',
  styleUrl: './detail-category.component.css'
})

export class DetailCategoryComponent implements OnInit {
  currentDate!: Date;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  projectId!: string;

  constructor(private route: ActivatedRoute, private router: Router) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('currentDate');
    this.currentDate = new Date(date!);
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }

  add(): void {
    this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'add-expense', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
