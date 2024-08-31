import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IDictionary } from '../../../core/interfaces/IDictionary';
import { AuthService } from '../../../core/services/auth.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit{
  registerForm!: FormGroup;
  httpErrors = false;
  errors: IDictionary<string> = {};
  constructor(private authService: AuthService, private router: Router) {
    this.authService.isSignedIn$.subscribe(value => {
      if (value) {
        this.router.navigate(['/']);
      }
    });
}

  ngOnInit(){
    this.buildRegisterForm();
  }

  buildRegisterForm(){
    this.registerForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.pattern("(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}")]),
      confirmPassword: new FormControl('',[Validators.required])
    },{validators: passwordMatchValidator}); 
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

      this.authService.register(email, password).subscribe({
        next: response => {
          this.router.navigate(['login']);
        },
        error: response => {
          this.httpErrors = true;
          this.errors = JSON.parse(response.error)?.errors;
        }
      });
    }
  }
}
