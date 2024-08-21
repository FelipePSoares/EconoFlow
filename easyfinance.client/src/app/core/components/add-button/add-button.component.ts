import { Component, EventEmitter, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-add-button',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './add-button.component.html',
  styleUrl: './add-button.component.css'
})
export class AddButtonComponent {
  faPlus = faPlus;

  @Output() incomeEvent = new EventEmitter();
  @Output() categoryEvent = new EventEmitter();

  income(): void {
    this.incomeEvent.emit();
  }

  category(): void {
    this.categoryEvent.emit();
  }
}
