import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from 'src/app/core/services/user.service';

import { ContactUsService } from 'src/app/core/services/contactus.service';
import { Router } from '@angular/router';
import { ApiErrorResponse } from 'src/app/core/models/error';
import { ContactUs } from 'src/app/core/models/contact-us';
import { ErrorMessageService } from 'src/app/core/services/error-message.service';
import { ContactUsDto } from './models/contactus-dto';
import { User } from 'src/app/core/models/user';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-contact-us',
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
],
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.css']
})
export class ContactUsComponent {
  contactForm: FormGroup;
  submitted = false;
  httpErrors = false;
  isLoggedIn = false;
  errors!: Record<string, string[]>;
  messages: ContactUs[] = [];
  _user = new User();

  constructor(
    private fb: FormBuilder,
    public userService: UserService,
    private contactUsService: ContactUsService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
  ) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }
  
  ngOnInit(): void {
    this.userService.loggedUser$.subscribe(user => {
      if (user && user.email) {
        this._user = user;
        this.isLoggedIn = true;
        this.contactForm.patchValue({
          name: user.fullName,
          email: user.email
        });
      } else {
        this.isLoggedIn = false;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.contactForm.valid) {
      const name = this.f?.['name'].value;
      const email = this.f?.['email'].value;
      const subject = this.f?.['subject'].value;
      const message = this.f?.['message'].value;

      const contactData = ({
        name: name,
        email: email,
        subject: subject,
        message: message,
        createdBy: this.isLoggedIn ? this._user : null
      }) as ContactUsDto;

      this.contactUsService.add(contactData).subscribe({
        next: response => {
          this.router.navigate([{ outlets: { modal: null } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;
          this.errorMessageService.setFormErrors(this.contactForm, this.errors);
        }
      });
      if (this.isLoggedIn) {
        this.contactForm.reset({
          name: this.f?.['name'].value,
          email: this.f?.['email'].value
        });
      } else {
        this.contactForm.reset();
      }
      this.submitted = false;
    }
  }

  get f() {
    return this.contactForm.controls;
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.contactForm, fieldName);
  }
}
