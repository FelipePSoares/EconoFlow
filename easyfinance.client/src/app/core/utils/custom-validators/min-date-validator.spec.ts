import { FormControl } from '@angular/forms';
import moment from 'moment';
import { minDateValidator, getMinAllowedDate } from './min-date-validator';

describe('minDateValidator', () => {
  const today = new Date();
  const tenYearsAgo = getMinAllowedDate(today);

  it('should return null for a date that is exactly 10 years ago', () => {
    const control = new FormControl(moment(tenYearsAgo));
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toBeNull();
  });

  it('should return null for a date that is more recent than 10 years ago', () => {
    const recentDate = new Date();
    const control = new FormControl(moment(recentDate));
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toBeNull();
  });

  it('should return a minDate error for a date older than 10 years', () => {
    const oldDate = new Date(tenYearsAgo.getFullYear() - 1, 0, 1);
    const control = new FormControl(moment(oldDate));
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toEqual({ minDate: true });
  });

  it('should return null when control value is empty', () => {
    const control = new FormControl(null);
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toBeNull();
  });

  it('should return null when control value is an invalid moment', () => {
    const control = new FormControl(moment('invalid-date'));
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toBeNull();
  });

  it('should work with a plain Date object as control value', () => {
    const oldDate = new Date(tenYearsAgo.getFullYear() - 1, 0, 1);
    const control = new FormControl(oldDate);
    const validator = minDateValidator(tenYearsAgo);
    expect(validator(control)).toEqual({ minDate: true });
  });

  describe('getMinAllowedDate', () => {
    it('should return a date exactly 10 years before the provided date', () => {
      const date = new Date(2026, 3, 15);
      const result = getMinAllowedDate(date);
      expect(result.getFullYear()).toBe(2016);
      expect(result.getMonth()).toBe(3);
      expect(result.getDate()).toBe(15);
    });
  });
});
