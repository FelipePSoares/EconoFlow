import { DatePipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ListExpensesComponent } from '../../expense/list-expenses/list-expenses.component';

@Component({
  selector: 'app-detail-category',
  standalone: true,
  imports: [DatePipe, ListExpensesComponent],
  templateUrl: './detail-category.component.html',
  styleUrl: './detail-category.component.css'
})

export class DetailCategoryComponent implements OnInit {
  @Input({ required: true })
  categoryId!: string;
  filterDate!: Date;

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('filterDate');
    this.filterDate = new Date(date!);
  }
}
