import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { EncryptionService } from './encryption.service';
import { map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  public USER_DATA = "user_data";

  constructor(@Inject(PLATFORM_ID) private platformId: object, private encryptionService: EncryptionService) { }

  public saveData(key: string, value: any): Observable<void> {
    if (isPlatformBrowser(this.platformId)) {
      try {
        return this.encrypt(JSON.stringify(value)).pipe(map(encryptedValue => localStorage.setItem(key, encryptedValue)))
      } catch (e) {
        console.error(e);

        this.removeData(key);
      }
    }

    return of(undefined);
  }

  public getData<T>(key: string): Observable<T | undefined> {
    if (isPlatformBrowser(this.platformId)) {
      const dataEncrypted = localStorage.getItem(key);

      if (dataEncrypted) {
        try {
          return this.decrypt(dataEncrypted).pipe(map(data => JSON.parse(data)));
        }
        catch (e) {
          console.error(e);

          this.removeData(key);
        }
      }
    }

    return of(undefined);
  }

  public removeData(key: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(key);
    }
  }

  public clearData() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.clear();
    }
  }

  private encrypt(txt: string): Observable<string> {
    return this.encryptionService.getKey().pipe(map(key => {
      if (key)
        return CryptoJS.AES.encrypt(txt, key).toString();

      throw new Error("Can't load key");
    }));
  }

  private decrypt(txtToDecrypt: string): Observable<string> {
    return this.encryptionService.getKey().pipe(map(key => {
      if (key)
        return CryptoJS.AES.decrypt(txtToDecrypt, key).toString(CryptoJS.enc.Utf8);

      throw new Error("Can't load key");
    }));
  }
}
