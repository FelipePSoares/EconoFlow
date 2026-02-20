import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-add-button',
    imports: [TranslateModule],
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

  getLabelKey(value: string): string {
    switch (value.toLowerCase()) {
      case 'income':
        return 'AddButtonIncome';
      case 'expense':
        return 'AddButtonExpense';
      case 'expense item':
        return 'AddButtonExpenseItem';
      default:
        return value;
    }
  }
}
