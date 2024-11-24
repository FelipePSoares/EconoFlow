import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { GlobalService } from '../../services/global.service';

export function currencyValidator(globalService: GlobalService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    const onlyDecimalRegex = new RegExp(`^\\d+(\\${globalService.decimalSeparator}\\d+)?$`);
    const currencyRegex = new RegExp(`^\\d{1,3}(\\${globalService.groupSeparator}\\d{3})*(\\${globalService.decimalSeparator}\\d{1,2})?$`);

    return value !== null && !(currencyRegex.test(value) || onlyDecimalRegex.test(value)) ? { invalidCurrency: `Invalid amount format. (0${globalService.groupSeparator}000${globalService.decimalSeparator}00)` } : null;
  };
}
