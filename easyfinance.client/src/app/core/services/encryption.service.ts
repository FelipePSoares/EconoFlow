import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, finalize, map, Observable, of, switchMap, tap, shareReplay } from 'rxjs';
import { UserKey } from '../models/user-key';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private key: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
  private key$: Observable<string | undefined> = this.key.asObservable();
  private keyRequest$: Observable<string | undefined> | null = null;

  constructor(private http: HttpClient) { }

  getKey(): Observable<string | undefined> {
    return this.key$.pipe(
      switchMap(key => {
        if (key)
          return of(key);

        if (this.keyRequest$) {
          return this.keyRequest$;
        }

        this.keyRequest$ = this.http.get<UserKey>('/api/encryption/UserKey', {
          observe: 'body',
          responseType: 'json'
        }).pipe(
          map(userKey => userKey.key),
          tap(userKey => this.key.next(userKey)),
          finalize(() => {
            this.keyRequest$ = null;
          }),
          shareReplay(1)
        );

        return this.keyRequest$;
      })
    )
  }

  clearKey() {
    this.key.next(undefined);
  }
}
