import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';

import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import * as _moment from 'moment';
import { Moment } from 'moment';
import { dateUTC, todayUTC } from '../../utils/date/date';

const moment = _moment;

@Component({
  selector: 'app-current-date',
  standalone: true,
  imports: [
    DatePipe,
    FontAwesomeModule,
    MatButtonModule,
    MatDatepickerModule
  ],
  templateUrl: './current-date.component.html',
  styleUrl: './current-date.component.css',
  providers: [
    provideMomentDateAdapter({
      parse: {
        dateInput: 'MM/YYYY',
      },
      display: {
        dateInput: 'MM/YYYY',
        monthYearLabel: 'MMM YYYY',
        dateA11yLabel: 'LL',
        monthYearA11yLabel: 'MMMM YYYY',
      },
    })
  ]
})
export class CurrentDateComponent {
  faArrowRight = faArrowRight;
  faArrowLeft = faArrowLeft;
  private static _currentDate: Date;
  static get currentDate(): Date {
    if (!CurrentDateComponent._currentDate) {
      CurrentDateComponent._currentDate = todayUTC();
    }

    return CurrentDateComponent._currentDate;
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
    var newDate = dateUTC(CurrentDateComponent.currentDate);
    newDate.setMonth(CurrentDateComponent.currentDate.getMonth() + value, 1);
    CurrentDateComponent._currentDate = dateUTC(newDate);
    this.dateUpdatedEvent.emit(CurrentDateComponent.currentDate);
  }

  setMonthAndYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    var newDate = dateUTC(event.year(), event.month(), 1)
    CurrentDateComponent._currentDate = newDate;
    this.dateUpdatedEvent.emit(CurrentDateComponent.currentDate);
    datepicker.close(); 
  }
}
