import { Component, Input, OnInit } from '@angular/core';
import { ListIncomesComponent } from '../../income/list-incomes/list-incomes.component';
import { ListCategoriesComponent } from '../../category/list-categories/list-categories.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [ListIncomesComponent, ListCategoriesComponent, CurrentDateComponent, AddButtonComponent],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;
  currentDate!: Date;

  constructor(private router: Router) {

  }

  ngOnInit(): void {
    this.currentDate = new Date();
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }

  addIncome() {
    this.router.navigate(['projects', this.projectId, 'add-income', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  addCategory() {
    this.router.navigate(['projects', this.projectId, 'add-category']);
  }
}
