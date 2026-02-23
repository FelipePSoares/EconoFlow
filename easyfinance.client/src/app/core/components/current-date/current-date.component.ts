import { DatePipe } from '@angular/common';
import { Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
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

  @Input() mode: 'month' | 'year' = 'month';
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

  get displayFormat(): string {
    return this.isYearMode ? 'yyyy' : 'MMM yyyy';
  }

  get pickerStartView(): 'year' | 'multi-year' {
    return this.isYearMode ? 'multi-year' : 'year';
  }

  previousMonth(): void {
    this.changeDate(-1);
  }

  nextMonth(): void {
    this.changeDate(1);
  }

  changeDate(value: number): void {
    const currentDate = this.currentDateService.currentDate;
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);

    if (this.isYearMode) {
      newDate.setFullYear(newDate.getFullYear() + value);
    } else {
      newDate.setMonth(newDate.getMonth() + value);
    }

    this.currentDateService.currentDate = newDate;
    this.emitCurrentDate();
  }

  setMonthAndYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    if (this.isYearMode) {
      return;
    }

    const newDate = new Date(event.year(), event.month(), 1, 12);
    this.currentDateService.currentDate = newDate;
    this.emitCurrentDate();
    datepicker.close();
  }

  setYear(event: Moment, datepicker: MatDatepicker<Moment>): void {
    if (!this.isYearMode) {
      return;
    }

    const currentDate = this.currentDateService.currentDate;
    const newDate = new Date(event.year(), currentDate.getMonth(), 1, 12);
    this.currentDateService.currentDate = newDate;
    this.emitCurrentDate();
    datepicker.close();
  }

  private get isYearMode(): boolean {
    return this.mode === 'year';
  }

  private emitCurrentDate(): void {
    this.dateUpdatedEvent.emit(this.currentDateService.currentDate);
  }
}
