import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  public USER_DATA = "user_data";
  public TOKEN_DATA = "token_data";

  key = "123";

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  public saveData(key: string, value: any) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, this.encrypt(JSON.stringify(value)));
    }
  }

  public getData<T>(key: string): T | undefined {
    if (isPlatformBrowser(this.platformId)) {
      let data = localStorage.getItem(key);

      if (data) {
        try {
          return JSON.parse(this.decrypt(data));
        }
        catch (e) {
          console.error(e);

          if (e instanceof Error) {
            if (e.message === "Malformed UTF-8 data") {
              this.removeData(key);
            }
          }
        }
      }
    }

    return undefined;
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

  private encrypt(txt: string): string {
    return CryptoJS.AES.encrypt(txt, this.key).toString();
  }

  private decrypt(txtToDecrypt: string) {
    return CryptoJS.AES.decrypt(txtToDecrypt, this.key).toString(CryptoJS.enc.Utf8);
  }
}
