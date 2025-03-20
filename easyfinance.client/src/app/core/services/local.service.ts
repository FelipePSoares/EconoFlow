import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  public USER_DATA = "user_data";
  public TOKEN_DATA = "token_data";

  key = "123";

  constructor() { }

  public saveData(key: string, value: any) {
    localStorage.setItem(key, this.encrypt(JSON.stringify(value)));
  }

  public getData<T>(key: string): T | undefined {
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

    return undefined;
  }

  public removeData(key: string) {
    localStorage.removeItem(key);
  }

  public clearData() {
    localStorage.clear();
  }

  private encrypt(txt: string): string {
    return CryptoJS.AES.encrypt(txt, this.key).toString();
  }

  private decrypt(txtToDecrypt: string) {
    return CryptoJS.AES.decrypt(txtToDecrypt, this.key).toString(CryptoJS.enc.Utf8);
  }
}
