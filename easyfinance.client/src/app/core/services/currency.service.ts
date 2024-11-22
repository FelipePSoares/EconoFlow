import { DecimalPipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { GlobalService } from './global.service';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  constructor(private globalService: GlobalService, private decimalPipe: DecimalPipe) { }

  getAvailableCurrencies(): string[] {
    return [
      "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD",
      "MXN", "SGD", "HKD", "NOK", "KRW", "TRY", "RUB", "INR", "BRL", "ZAR",
      "PLN", "DKK", "TWD", "THB", "IDR", "HUF", "CZK", "ILS", "PHP", "MYR",
      "SAR", "QAR", "AED", "CLP", "PEN", "COP", "ARS", "VND", "EGP", "BGN",
      "HRK", "RON", "ISK", "NGN", "KZT", "GHS", "KWD", "BHD", "OMR", "JOD"
    ];
  }

  parseLocaleCurrencyToNumber(value: string): number {
    try {
      const normalizedValue = value
        .replace(new RegExp(`\\s|[^0-9${this.globalService.decimalSeparator}-]`, 'g'), '') // Remove all but numbers and the decimal
        .replace(new RegExp(`\\${this.globalService.decimalSeparator}`), '.'); // Replace locale decimal with JS decimal

      return parseFloat(normalizedValue);
    } catch (error) {
      console.error("Failed to parse currency:", error);
      return 0;
    }
  }

  parseNumberToLocaleCurrency(value: number): string | null {
    try {
      return this.decimalPipe.transform(value, '1.2-2', this.globalService.languageLoaded);
    } catch (error) {
      console.error("Failed to parse currency:", error);
      return null;
    }
  }
}
