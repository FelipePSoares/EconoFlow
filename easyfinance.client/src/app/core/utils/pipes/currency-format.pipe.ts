import { inject, Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { GlobalService } from '../../services/global.service';

@Pipe({
  name: 'currencyFormat',
  standalone: true,
})
export class CurrencyFormatPipe implements PipeTransform {
  // Keep the pipe usable in isolated tests/components even when CurrencyPipe
  // is not provided at injector level.
  private currencyPipe = inject(CurrencyPipe, { optional: true }) ?? new CurrencyPipe('en-US');
  private globalService = inject(GlobalService);

  transform(amount: number, hideDecimals = false): string | null {

    const digitsInfo = hideDecimals ? '1.0-0' : '1.2-2';

    return this.currencyPipe.transform(amount, this.globalService.currency, "symbol", digitsInfo, this.globalService.currentLanguage);
  }
}
