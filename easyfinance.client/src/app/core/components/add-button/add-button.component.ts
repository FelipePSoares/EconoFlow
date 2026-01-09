import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-add-button',
    templateUrl: './add-button.component.html',
    styleUrl: './add-button.component.css'
})
export class AddButtonComponent {
  @Output() clickedEvent = new EventEmitter();
  @Input()
  buttons!: string[];

  clicked(value: string): void {
    this.clickedEvent.emit(value);
  }
}
