import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { passwordMatchValidator } from '../../Common/CustomValidators/passwordMatchValidator';
import { RegisterService } from 'src/app/Services/RegisterService/register.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit{
  registerForm!: FormGroup;

  constructor(private registerService: RegisterService){}

  ngOnInit(){
    this.buildRegisterForm();
  }

  buildRegisterForm(){
    this.registerForm = new FormGroup({
      email: new FormControl('',[Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
      confirmPassword: new FormControl('',[Validators.required])
    },{validators: passwordMatchValidator}); 
  }

  onSubmit(){
    this.registerService.register(this.registerForm.value);
  }
}
