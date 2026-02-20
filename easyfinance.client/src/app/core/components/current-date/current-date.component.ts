import { DatePipe } from '@angular/common';
import { Component, DestroyRef, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { TranslateService } from '@ngx-translate/core';
import { Moment } from 'moment';
import { GlobalService } from '../../services/global.service';
import { CurrentDateService } from '../../services/current-date.service';

@Component({
  selector: 'app-current-date',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDatepickerModule
  ],
  templateUrl: './current-date.component.html',
  styleUrl: './current-date.component.css',
  providers: []
})
export class CurrentDateComponent implements OnInit {
  private dateAdapter = inject(DateAdapter<Date>);
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  currentLanguage = this.globalService.currentLanguage;

  @Output() dateUpdatedEvent = new EventEmitter<Date>();

  constructor(private currentDateService: CurrentDateService) { }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
        this.dateAdapter.setLocale(event.lang);
      });
  }

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
