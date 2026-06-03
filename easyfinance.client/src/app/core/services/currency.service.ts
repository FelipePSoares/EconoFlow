import { DecimalPipe } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { GlobalService } from './global.service';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private globalService = inject(GlobalService);
  private decimalPipe = inject(DecimalPipe);


  getAvailableCurrencies(): string[] {
    return [
      "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD",
      "MXN", "SGD", "HKD", "NOK", "KRW", "TRY", "RUB", "INR", "BRL", "ZAR",
      "PLN", "DKK", "TWD", "THB", "IDR", "HUF", "CZK", "ILS", "PHP", "MYR",
      "SAR", "QAR", "AED", "CLP", "PEN", "COP", "ARS", "VND", "EGP", "BGN",
      "HRK", "RON", "ISK", "NGN", "KZT", "GHS", "KWD", "BHD", "OMR", "JOD"
    ];
  }
}
