import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { ProjectService } from '../../services/project.service';

@Pipe({
  name: 'currencyFormat',
  standalone: true,
})
export class CurrencyFormatPipe implements PipeTransform {
  private preferredCurrency: string | undefined;

  constructor(private currencyPipe: CurrencyPipe, private projectService: ProjectService, private globalService: GlobalService) {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      this.preferredCurrency = userProject?.project.preferredCurrency;
    });
  }

  transform(amount: number, hideDecimals = false): string | null {

    const digitsInfo = hideDecimals ? '1.0-0' : '1.2-2';

    return this.currencyPipe.transform(amount, this.preferredCurrency ?? 'EUR', "symbol", digitsInfo, this.globalService.languageLoaded);
  }
}
