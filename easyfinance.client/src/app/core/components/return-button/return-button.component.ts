import { Component, EventEmitter, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-return-button',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './return-button.component.html',
  styleUrl: './return-button.component.css'
})
export class ReturnButtonComponent {
  faArrowLeft = faArrowLeft;

  @Output() returnButtonEvent = new EventEmitter();

  previous(): void {
    this.returnButtonEvent.emit();
  }
}
