import { Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, FormGroup } from "@angular/forms";

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {
  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    const control = form.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            case 'email':
              errors.push('Invalid email format.');
              break;
            case 'pattern':
              errors.push('');
              break;
            default:
              errors.push(control.errors ? control.errors[key] : 'an error occours!');
          }
        }
      }
    }

    return errors;
  }

  setFormErrors(form: FormGroup<any>, errors: { [key: string]: string }) {
    for (let key in errors) {
      const formControl = form.get(key.toLowerCase());
      this.setErrorFormControl(formControl, { [key]: errors[key] });
    }
  }

  private setErrorFormControl(formControl: AbstractControl | null, errors: ValidationErrors) {
    if (formControl) {
      const currentErrors = formControl.errors || {};
      const updatedErrors = { ...currentErrors, ...errors };
      formControl.setErrors(updatedErrors);
    }
  }
}
