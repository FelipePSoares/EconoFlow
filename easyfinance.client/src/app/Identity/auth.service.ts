import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) {
  }

  private authStateChanged: Subject<boolean> = new BehaviorSubject<boolean>(false);

  public onStateChanged() {
    return this.authStateChanged.asObservable();
  }

  public signIn(email: string, password: string) {
    return this.http.post('/api/account/login?useCookies=true', {
      email: email,
      password: password
    }, {
      observe: 'response',
      responseType: 'text'
    })
      .pipe<boolean>(map((res: HttpResponse<string>) => {
        this.authStateChanged.next(res.ok);
        return res.ok;
      }));
  }

  public isSignedIn() {
    return this.authStateChanged.asObservable();
  }

  public register(email: string, password: string) {
    return this.http.post('/api/account/register', {
      email: email,
      password: password
    }, {
      observe: 'response',
      responseType: 'text'
    })
      .pipe<boolean>(map((res: HttpResponse<string>) => {
        this.authStateChanged.next(res.ok);
        return res.ok;
      }));
  }

  public logout() {
    this.authStateChanged = new BehaviorSubject<boolean>(false);
  }
}
