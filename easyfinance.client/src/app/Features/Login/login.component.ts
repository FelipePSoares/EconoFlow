import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { LoginService } from 'src/app/Services/LoginService/login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup;
  loggedIn = false;
  httpErrors = false;
  errors : any;
  constructor(private loginService: LoginService){}

  ngOnInit(): void {
    this.buildLoginForm();
  }

  buildLoginForm(){
    this.loginForm = new FormGroup({
      email: new FormControl('',[Validators.email, Validators.required]),
      password: new FormControl('',[Validators.required]),
    });
  }

  onSubmit(){
    this.loginService.login(this.loginForm.value).subscribe({
      next: response =>{
        this.loggedIn = true;
        console.log(response);
      },
      error: error =>{
        this.httpErrors = true;
        this.errors = error;
      }
    });
  }

}
