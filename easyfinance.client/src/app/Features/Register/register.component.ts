import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { passwordMatchValidator } from '../../Common/CustomValidators/passwordMatchValidator';
import { AuthService } from '../../Identity/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit{
  registerForm!: FormGroup;
  errors: any;
  constructor(private authServie: AuthService, private router: Router) { }

  ngOnInit(){
    this.buildRegisterForm();
  }

  buildRegisterForm(){
    this.registerForm = new FormGroup({
      email: new FormControl('teste@teste.com',[Validators.required, Validators.email]),
      password: new FormControl('Passw0rd!', [Validators.required]),
      confirmPassword: new FormControl('Passw0rd!',[Validators.required])
    },{validators: passwordMatchValidator}); 
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const email = this.registerForm.get('email')?.value;
      const password = this.registerForm.get('password')?.value;

      this.authServie.register(email, password).subscribe({
        next: response => {
          this.router.navigate(['forecast']);
        },
        error: error => {
          this.errors = error;
        }
      });
    }
  }
}
