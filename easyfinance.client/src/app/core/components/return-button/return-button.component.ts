import { Component, EventEmitter, Output } from '@angular/core';

@Component({
    selector: 'app-return-button',
    templateUrl: './return-button.component.html',
    styleUrl: './return-button.component.css'
})
export class ReturnButtonComponent {
  @Output() returnButtonEvent = new EventEmitter();

  previous(): void {
    this.returnButtonEvent.emit();
  }
}
