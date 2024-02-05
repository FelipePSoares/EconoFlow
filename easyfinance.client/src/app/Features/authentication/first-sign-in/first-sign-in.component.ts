import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-first-sign-in',
  templateUrl: './first-sign-in.component.html',
  styleUrls: ['./first-sign-in.component.css']
})
export class FirstSignInComponent implements OnInit {

  userForm!: FormGroup;
  httpErrors = false;
  errors: any;

  constructor(private userService: UserService, private router: Router) { }

  ngOnInit(): void {
    this.buildUserForm();
  }

  buildUserForm() {
    this.userForm = new FormGroup({
      firstName: new FormControl('', [Validators.required]),
      lastName: new FormControl('', [Validators.required]),
    });
  }

  get firstName() {
    return this.userForm.get('firstName');
  }

  get lastName() {
    return this.userForm.get('lastName');
  }
  
  onSubmit(): void {
    if (this.userForm.valid) {
      const firstName = this.userForm.get('firstName')?.value;
      const lastName = this.userForm.get('lastName')?.value;

      this.userService.setUserInfo(firstName, lastName).subscribe({
        next: response => {
          this.router.navigate(['/']);
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }
}
