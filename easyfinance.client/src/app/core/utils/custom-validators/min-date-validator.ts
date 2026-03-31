import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import moment, { Moment } from 'moment';

export function getMinAllowedDate(currentDate: Date): Date {
  return moment(currentDate).subtract(10, 'years').toDate();
}

export function minDateValidator(minDate: Date): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const value: Moment = moment.isMoment(control.value)
      ? control.value
      : moment(control.value);

    if (!value.isValid()) {
      return null;
    }

    const normalizedValue = moment.utc({
      year: value.year(),
      month: value.month(),
      date: value.date(),
    });

    const normalizedMinDate = moment.utc({
      year: minDate.getFullYear(),
      month: minDate.getMonth(),
      date: minDate.getDate(),
    });

    return normalizedValue.isBefore(normalizedMinDate, 'day') ? { minDate: true } : null;
  };
}
