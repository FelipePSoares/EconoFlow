import { inject, Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, FormGroup } from "@angular/forms";
import { TranslateService } from "@ngx-translate/core";

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {
  private translate = inject(TranslateService);

  getFormFieldErrors(form: FormGroup, fieldName: string): string[] {
    const control = form.get(fieldName);
    let errors: string[] = [];

    if (control && control.errors) {
      for (const [key, errorValue] of Object.entries(control.errors)) {
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
            errors.push(this.translate.instant('ValueShouldBeGreaterThan', { value: (errorValue as { min: number }).min }));
            break;
          case 'minlength':
            errors.push(this.translate.instant('TextShouldBeGreaterThan', { value: (errorValue as { requiredLength: number }).requiredLength }));
            break;
          case 'maxlength':
            errors.push(
              this.translate.instant('PropertyMaxLength', {
                field: fieldName,
                max: (errorValue as { requiredLength: number }).requiredLength
              })
            );
            break;
          default:
            if (Array.isArray(errorValue)) {
              errors = errors.concat(errorValue as string[]);
            } else {
              errors.push('GenericError');
            }
            break;
        }
      }
    }

    return errors;
  }

  setFormErrors(form: FormGroup, errors: Record<string, string[]>) {
    for (const key in errors) {
      const controlName = Object.keys(form.controls).find(formControlName => formControlName.toLowerCase() === key.toLowerCase());
      const formControl = controlName ? form.get(controlName) : null;
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
