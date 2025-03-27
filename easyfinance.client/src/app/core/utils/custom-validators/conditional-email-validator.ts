import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export function conditionalEmailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (typeof value === 'string') {
      return Validators.email(control);
    }

    return null; // Se for um objeto, não há erro
  };
}
