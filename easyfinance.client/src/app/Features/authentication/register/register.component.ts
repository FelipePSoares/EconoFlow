import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IDictionary } from '../../../core/interfaces/IDictionary';
import { AuthService } from '../../../core/services/auth.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';

@Component({
  selector: 'app-register',
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
      email: new FormControl('teste@teste.com', [Validators.required, Validators.email]),
      password: new FormControl('Passw0rd!', [Validators.required, Validators.pattern("(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}")]),
      confirmPassword: new FormControl('Passw0rd!',[Validators.required])
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
