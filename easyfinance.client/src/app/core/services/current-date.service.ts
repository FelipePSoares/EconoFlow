import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CurrentDateService {
  private _currentDate: Date;

  constructor() {
    this._currentDate = new Date();
    this.resetDateToday();
  }

  /**
   * Returns the current date as a JavaScript Date object.
   */
  get currentDate(): Date {
    if (!this._currentDate) {
      this.resetDateToday();
    }
    return this._currentDate;
  }

  /**
   * Sets the current date to a specific date.
   * @param date - The date to set as the current date.
   */
  set currentDate(date: Date) {
    if (date instanceof Date && !isNaN(date.getTime())) {
      this._currentDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
    } else {
      throw new Error('Invalid date provided');
    }
  }

  /**
   * Resets the current date to today, ensuring the time is set to midnight.
   */
  resetDateToday() {
    const today = new Date();
    this._currentDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
  }
}
