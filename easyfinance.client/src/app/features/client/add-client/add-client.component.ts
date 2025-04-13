import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ClientDto } from '../models/client-dto';
import { ApiErrorResponse } from '../../../core/models/error';

@Component({
  selector: 'app-add-client',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './add-client.component.html',
  styleUrl: './add-client.component.css'
})
export class AddClientComponent implements OnInit {
  clientForm!: FormGroup;
  httpErrors = false;
  errors!: Record<string, string[]>;

  @Input({ required: true })
  projectId!: string;

  constructor(
    private clientService: ClientService,
    private router: Router,
    private errorMessageService: ErrorMessageService
  ) { }

  ngOnInit(): void {
    this.clientForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.email]),
      phone: new FormControl('', [Validators.pattern('^([0-9]*)$')]),
      description: new FormControl('')
    });
  }

  save() {
    if (this.clientForm.valid) {
      const name = this.name?.value;
      const email = this.email?.value;
      const phone = this.phone?.value;
      const description = this.description?.value;

      const newClient = ({
        name: name,
        email: email,
        phone: phone,
        description: description,
        isActive: true
      }) as ClientDto;

      this.clientService.add(this.projectId, newClient).subscribe({
        next: () => {
          this.router.navigate([{ outlets: { modal: null } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.clientForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.clientForm, fieldName);
  }

  get name() {
    return this.clientForm.get('name');
  }
  get email() {
    return this.clientForm.get('email');
  }
  get phone() {
    return this.clientForm.get('phone');
  }
  get description() {
    return this.clientForm.get('description');
  }
}
