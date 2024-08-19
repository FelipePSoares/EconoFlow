import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-current-date',
  standalone: true,
  imports: [DatePipe, FontAwesomeModule],
  templateUrl: './current-date.component.html',
  styleUrl: './current-date.component.css'
})
export class CurrentDateComponent {
  faArrowRight = faArrowRight;
  faArrowLeft = faArrowLeft;

  @Input({ required: true })
  currentDate!: Date;

  @Output() dateUpdatedEvent = new EventEmitter<Date>();

  previous(): void {
    this.changeDate(-1);
  }

  next(): void {
    this.changeDate(1);
  }

  changeDate(value: number) {
    var newDate = new Date(this.currentDate);
    newDate.setMonth(this.currentDate.getMonth() + value);
    this.currentDate = newDate;
    this.dateUpdatedEvent.emit(this.currentDate);
  }
}
