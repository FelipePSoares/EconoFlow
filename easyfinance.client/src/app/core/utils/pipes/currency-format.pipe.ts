import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { ProjectService } from '../../services/project.service';

@Pipe({
  name: 'currencyFormat',
  standalone: true,
})
export class CurrencyFormatPipe implements PipeTransform {

  constructor(private currencyPipe: CurrencyPipe, private projectService: ProjectService, private globalService: GlobalService) { }

  transform(amount: number, hideDecimals: boolean = false): string | null {
    const userProject = this.projectService.getSelectedUserProject();

    const digitsInfo = hideDecimals ? '1.0-0' : '1.2-2';

    return this.currencyPipe.transform(amount, userProject?.project?.preferredCurrency ?? 'EUR', "symbol", digitsInfo, this.globalService.languageLoaded);
  }
}
