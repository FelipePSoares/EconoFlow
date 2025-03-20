import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { take } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {MatIcon} from "@angular/material/icon";
import { TranslateModule } from '@ngx-translate/core';
import { ErrorMessageService } from '../../../core/services/error-message.service';

@Component({
    selector: 'app-login',
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
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  hide = true;

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private errorMessageService: ErrorMessageService) {
    this.authService.isSignedIn$.pipe(take(1)).subscribe(value => {
      if (value) {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnInit(): void {
    this.buildLoginForm();
  }

  buildLoginForm() {
    this.loginForm = new FormGroup({
      email: new FormControl('', [Validators.email, Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const email = this.loginForm.get('email')?.value;
      const password = this.loginForm.get('password')?.value;

      this.authService.signIn(email, password).subscribe({
        next: response => {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'];
          
          if (returnUrl) {
            this.router.navigateByUrl(returnUrl);
          } else if (response.defaultProjectId) {
            this.router.navigate(['/projects', response.defaultProjectId]);
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.loginForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.loginForm, fieldName);
  }
}
