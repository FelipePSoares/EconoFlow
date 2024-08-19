import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ListExpensesComponent } from '../../expense/list-expenses/list-expenses.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';

@Component({
  selector: 'app-detail-category',
  standalone: true,
  imports: [ListExpensesComponent, CurrentDateComponent],
  templateUrl: './detail-category.component.html',
  styleUrl: './detail-category.component.css'
})

export class DetailCategoryComponent implements OnInit {
  currentDate!: Date;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  projectId!: string;

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('currentDate');
    this.currentDate = new Date(date!);
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }
}
