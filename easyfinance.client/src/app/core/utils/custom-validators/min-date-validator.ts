import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import moment, { Moment } from 'moment';

export function getMinAllowedDate(currentDate: Date): Date {
  return new Date(currentDate.getFullYear() - 10, currentDate.getMonth(), currentDate.getDate());
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

    return value.isBefore(moment(minDate), 'day') ? { minDate: true } : null;
  };
}
