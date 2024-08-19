import { Component, Input, OnInit } from '@angular/core';
import { ListIncomesComponent } from '../../income/list-incomes/list-incomes.component';
import { ListCategoriesComponent } from '../../category/list-categories/list-categories.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [ListIncomesComponent, ListCategoriesComponent, CurrentDateComponent],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;
  currentDate!: Date;

  ngOnInit(): void {
    this.currentDate = new Date();
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }
}
