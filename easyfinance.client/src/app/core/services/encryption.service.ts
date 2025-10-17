import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, finalize, map, Observable, of, Subject, switchMap } from 'rxjs';
import { UserKey } from '../models/user-key';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private key: Subject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
  private key$: Observable<string | undefined> = this.key.asObservable();
  private promise!: Observable<string>;
  private isGettingNewKey = false;

  constructor(private http: HttpClient) { }

  getKey(): Observable<string | undefined> {
    return this.key$.pipe(
      switchMap(key => {
        if (key)
          return of(key);

        if (!this.isGettingNewKey) {
          this.isGettingNewKey = true;

          this.promise = this.http.get<UserKey>('/api/encryption/UserKey', {
            observe: 'body',
            responseType: 'json'
          }).pipe(map(userKey => {
            this.key.next(userKey.key);
            return userKey.key;
          }),
            finalize(() => this.isGettingNewKey = false));

          return this.promise;
        }

        return this.promise;
      })
    )
  }

  clearKey() {
    this.key.next(undefined);
  }
}
