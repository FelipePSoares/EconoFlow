import { Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, FormGroup } from "@angular/forms";
import { TranslateService } from "@ngx-translate/core";

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {
  constructor(private translate: TranslateService) { }

  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    const control = form.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('RequiredField');
              break;
            case 'email':
              errors.push('');
              break;
            case 'pattern':
              if (fieldName === 'budget') {
                errors.push('OnlyNumbersIsValid');
              }
              errors.push('');
              break;
            case 'min':
              errors.push(this.translate.instant('ValueShouldBeGreaterThan', { value: control.errors[key].min }));
              break;
            default:
              errors.push(control.errors ? control.errors[key] : 'GenericError');
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
