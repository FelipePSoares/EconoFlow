import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';

import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import * as _moment from 'moment';
import { Moment } from 'moment';

const moment = _moment;

export const MY_FORMATS = {
  parse: {
    dateInput: 'MM/YYYY',
  },
  display: {
    dateInput: 'MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

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
    provideMomentDateAdapter(MY_FORMATS)
  ]
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

  setMonthAndYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    var newDate = new Date(event.year(), event.month(), this.currentDate.getDate());
    this.currentDate = newDate;
    this.dateUpdatedEvent.emit(this.currentDate);
    datepicker.close(); 
  }
}
