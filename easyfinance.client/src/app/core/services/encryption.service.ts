import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of, Subject, switchMap } from 'rxjs';
import { UserKey } from '../models/user-key';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private key: Subject<string | undefined> = new BehaviorSubject<string | undefined>("Test");
  private key$: Observable<string | undefined> = this.key.asObservable();
  private keyPromise?: Observable<string>;

  constructor(private http: HttpClient) { }

  getKey(): Observable<string> {
    return this.key$.pipe(
      switchMap(key => {
        if (key) {
          return of(key);
        } else if (this.keyPromise) {
          return this.keyPromise;
        }

        this.keyPromise = this.http.get<UserKey>('/api/encryption/UserKey', {
          observe: 'body',
          responseType: 'json'
        }).pipe(map(userKey => {
          this.key.next(userKey.key);
          this.keyPromise = undefined;
          return userKey.key;
        }));

        return this.keyPromise;
      })
    )
  }

  clearKey() {
    this.key.next(undefined);
  }
}
