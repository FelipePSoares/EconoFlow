import { Component, Input } from '@angular/core';
import { ListIncomesComponent } from '../../income/list-incomes/list-incomes.component';

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [ListIncomesComponent],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent {
  @Input({ required: true })
  projectId!: string;
}
