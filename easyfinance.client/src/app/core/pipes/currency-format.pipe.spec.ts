import { CurrencyPipe } from '@angular/common';
import { CurrencyFormatPipe } from './currency-format.pipe';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

//registerLocaleData(localeDe); enable to test de-DE

describe('CurrencyFormatPipe', () => {
  let pipe: CurrencyFormatPipe;
  let currencyPipe: CurrencyPipe;

  beforeEach(() => {
    currencyPipe = new CurrencyPipe('en-US'); // change currency in order to test different currency
    pipe = new CurrencyFormatPipe(currencyPipe);
  });

  it('should format the Euro amount correctly for German locale (de-DE)', () => {
    const amount = 1234.56;
    const preferedCurrency = 'EUR';
    const result = pipe.transform(amount, preferedCurrency);

    expect(result).toEqual('1.234,56\u00A0€');
  });

  it('should format the Dollars amount correctly for US locale (en-US)', () => {
    const amount = 1234.56;
    const preferedCurrency = 'USD';
    const result = pipe.transform(amount, preferedCurrency);

    expect(result).toEqual('$1,234.56');
  });
});
