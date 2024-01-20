import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoginService } from 'src/app/Services/LoginService/login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup;
  loggedIn = false;

  constructor(private formBuilder: FormBuilder, private loginService: LoginService){}

  ngOnInit(): void {
    this.buildLoginForm();
  }

  buildLoginForm(){
    this.loginForm = this.formBuilder.group({
      email:['', [Validators.required, Validators.email]],
      password:['', Validators.required]
    });
  }

  onSubmit(){
    this.loginService.login(this.loginForm).subscribe({
      next: response =>{
        this.loggedIn = true;
        console.log(response);
      },
      error: error =>{
        console.log(error);
      }
    });
  }

}
