import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';

import { Moment } from 'moment';
import { CurrentDateService } from '../../services/current-date.service';

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

  @Output() dateUpdatedEvent = new EventEmitter<Date>();

  constructor(private currentDateService: CurrentDateService) { }

  getCurrentDate(): Date {
    return this.currentDateService.currentDate;
  }

  previousMonth(): void {
    this.changeDate(-1);
  }

  nextMonth(): void {
    this.changeDate(1);
  }

  changeDate(value: number) {
    const currentDate = this.currentDateService.currentDate;
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + value);
    this.currentDateService.currentDate = currentDate;
    this.dateUpdatedEvent.emit(this.currentDateService.currentDate);
  }

  setMonthAndYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    const newDate = new Date(event.year(), event.month(), 1, 12);
    this.currentDateService.currentDate = newDate;
    this.dateUpdatedEvent.emit(this.currentDateService.currentDate);
    datepicker.close();
  }
}
