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
    let errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('RequiredField');
              break;
            case 'email':
              errors.push('InvalidEmailFormat');
              break;
            case 'pattern':
              switch (fieldName) {
                case 'phone':
                case 'budget':
                  errors.push('OnlyNumbersIsValid');
                  break;
                default:
                  errors.push('');
                  break;
              }
              break;
            case 'min':
              errors.push(this.translate.instant('ValueShouldBeGreaterThan', { value: control.errors[key].min }));
              break;
            case 'minlength':
              errors.push(this.translate.instant('TextShouldBeGreaterThan', { value: control.errors[key].requiredLength }));
              break;
            default:
              errors = errors.concat(control.errors ? control.errors[key] : ['GenericError']);
          }
        }
      }
    }

    return errors;
  }

  setFormErrors(form: FormGroup<any>, errors: Record<string, string[]>) {
    for (const key in errors) {
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
