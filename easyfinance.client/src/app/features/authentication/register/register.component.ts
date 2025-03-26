import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from "@angular/material/icon";
import { CommonModule } from '@angular/common';
import confetti from 'canvas-confetti';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';

@Component({
    selector: 'app-register',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterLink,
        MatFormFieldModule,
        MatInputModule,
        MatIcon,
        TranslateModule
    ],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  hidePassword = true;
  hideConfirmPassword = true;

  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private errorMessageService: ErrorMessageService) {
  }

  ngOnInit() {
    this.authService.isSignedIn$.pipe(take(1)).subscribe(value => {
      if (value) {
        this.router.navigate(['/projects']);
      }
    });

    this.buildRegisterForm();
  }

  buildRegisterForm(){
    this.registerForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('',[Validators.required])
    },{validators: passwordMatchValidator});

    this.registerForm.valueChanges.subscribe(value => {
      this.hasLowerCase = /[a-z]/.test(value.password);
      this.hasUpperCase = /[A-Z]/.test(value.password);
      this.hasOneNumber = /[0-9]/.test(value.password);
      this.hasOneSpecial = /[\W_]/.test(value.password);
      this.hasMinCharacteres = /^.{8,}$/.test(value.password);
    });
  }

  get email() {
    return this.registerForm.get('email');
  }
  get password() {
    return this.registerForm.get('password');
  }
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const email = this.registerForm.get('email')?.value;
      const password = this.registerForm.get('password')?.value;
      const token = this.route.snapshot.queryParams['token'];

      this.authService.register(email, password, token).subscribe({
        next: response => {
          this.celebrate();
          this.router.navigate(['/first-signin']);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.registerForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.registerForm, fieldName);
  }


  celebrate() {
    confetti({
      particleCount: 150,
      spread: 150,
      ticks: 250,
      startVelocity: 30,
      decay: 0.95,
      origin: {
        y: 0.5
      }
    });
  }
}
