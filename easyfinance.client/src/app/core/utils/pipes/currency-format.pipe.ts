import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { UserService } from '../../services/user.service';
import { GlobalService } from '../../services/global.service';

@Pipe({
  name: 'currencyFormat',
  standalone: true,
})
export class CurrencyFormatPipe implements PipeTransform {
  private preferredCurrency!: string;

  constructor(private currencyPipe: CurrencyPipe, private userService: UserService, private globalService: GlobalService) {
    userService.loggedUser$.subscribe(user => {
      this.preferredCurrency = user.preferredCurrency;
    })
  }

  transform(amount: number): string | null {
    return this.currencyPipe.transform(amount, this.preferredCurrency, "symbol", '1.2-2', this.globalService.languageLoaded);
  }
}
