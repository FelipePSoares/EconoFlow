import { Component, Input, OnInit } from '@angular/core';
import { ListIncomesComponent } from '../../income/list-incomes/list-incomes.component';
import { ListCategoriesComponent } from '../../category/list-categories/list-categories.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [DatePipe, ListIncomesComponent, ListCategoriesComponent],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;
  filterDate!: Date;

  ngOnInit(): void {
    this.filterDate = new Date();
  }
}
