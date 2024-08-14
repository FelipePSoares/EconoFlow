import { DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-detail-category',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detail-category.component.html',
  styleUrl: './detail-category.component.css'
})

export class DetailCategoryComponent implements OnInit {
  filterDate!: Date;

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('filterDate');
    this.filterDate = new Date(date!);
  }
}
