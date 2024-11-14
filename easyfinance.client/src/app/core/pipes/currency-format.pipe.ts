import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Pipe({
  name: 'currencyFormat',
  standalone: true,
})
export class CurrencyFormatPipe implements PipeTransform {
  constructor(private currencyPipe: CurrencyPipe) {}
  transform(amount: number, preferedCurrency: string): string | null {
    return this.currencyPipe.transform(amount, preferedCurrency);
  }
}
