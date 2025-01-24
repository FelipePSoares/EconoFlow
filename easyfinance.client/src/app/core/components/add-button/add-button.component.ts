import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-add-button',
    imports: [FontAwesomeModule],
    templateUrl: './add-button.component.html',
    styleUrl: './add-button.component.css'
})
export class AddButtonComponent {
  faPlus = faPlus;

  @Output() clickedEvent = new EventEmitter();
  @Input()
  buttons!: string[];

  clicked(value: string): void {
    this.clickedEvent.emit(value);
  }
}
