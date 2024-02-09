import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const comboRequiredValidator: ValidatorFn = (
    control: AbstractControl
    ): ValidationErrors | null => {
    return control.value === "Choose..." || control.value === '' || control.value === null ? { required: true } : null;
}; 
