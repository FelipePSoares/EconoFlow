import { Component, Input, OnInit } from '@angular/core';
import { ListIncomesComponent } from '../../income/list-incomes/list-incomes.component';
import { ListCategoriesComponent } from '../../category/list-categories/list-categories.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [ListIncomesComponent, ListCategoriesComponent, CurrentDateComponent, AddButtonComponent, ReturnButtonComponent],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  btnIncome = 'Income';
  btnCategory = 'Category';
  @Input({ required: true })
  projectId!: string;
  currentDate!: Date;
  buttons: string[] = [this.btnIncome, this.btnCategory];

  constructor(private router: Router, private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('currentDate');
    this.currentDate = date == null ? new Date() : new Date(date);
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }

  add(value: string) {
    if (value == this.btnIncome) {
      this.router.navigate(['projects', this.projectId, 'add-income', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
    }
    else if (value == this.btnCategory) {
      this.router.navigate(['projects', this.projectId, 'add-category']);
    }
  }

  previous() {
    this.router.navigate(['projects']);
  }
}
