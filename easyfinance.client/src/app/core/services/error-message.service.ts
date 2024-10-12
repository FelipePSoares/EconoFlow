import { Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, FormGroup } from "@angular/forms";

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {
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
