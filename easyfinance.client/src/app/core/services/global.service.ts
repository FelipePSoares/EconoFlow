import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  public languageLoaded: string = 'en-US';
  public groupSeparator: string = '.';
  public decimalSeparator: string = ',';

  constructor() { }
}
