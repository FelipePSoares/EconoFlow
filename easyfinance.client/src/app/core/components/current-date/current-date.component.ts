import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';

import { Moment } from 'moment';

@Component({
  selector: 'app-current-date',
  imports: [
    DatePipe,
    FontAwesomeModule,
    MatButtonModule,
    MatDatepickerModule
  ],
  templateUrl: './current-date.component.html',
  styleUrl: './current-date.component.css',
  providers: []
})
export class CurrentDateComponent {
  faArrowRight = faArrowRight;
  faArrowLeft = faArrowLeft;
  private static _currentDate: Date;
  static get currentDate(): Date {
    if (!CurrentDateComponent._currentDate) {
      this.resetDateToday();
    }
    return CurrentDateComponent._currentDate;
  }

  static resetDateToday(): void {
    const today = new Date();
    CurrentDateComponent._currentDate = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ));
  }

  @Output() dateUpdatedEvent = new EventEmitter<Date>();

  getCurrentDate(): Date {
    return CurrentDateComponent.currentDate;
  }

  previousMonth(): void {
    this.changeDate(-1);
  }

  nextMonth(): void {
    this.changeDate(1);
  }

  changeDate(value: number) {
    const currentDate = new Date(CurrentDateComponent.currentDate);
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + value);
    CurrentDateComponent._currentDate = currentDate;
    this.dateUpdatedEvent.emit(CurrentDateComponent.currentDate);
  }

  setMonthAndYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    const newDate = new Date(event.year(), event.month(), 1, 12);
    CurrentDateComponent._currentDate = newDate;
    this.dateUpdatedEvent.emit(CurrentDateComponent.currentDate);
    datepicker.close();
  }
}
