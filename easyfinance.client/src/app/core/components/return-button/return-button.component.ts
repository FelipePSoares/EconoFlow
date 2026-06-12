import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-return-button',
    templateUrl: './return-button.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './return-button.component.css'
})
export class ReturnButtonComponent {
  @Output() returnButtonEvent = new EventEmitter();

  previous(): void {
    this.returnButtonEvent.emit();
  }
}
