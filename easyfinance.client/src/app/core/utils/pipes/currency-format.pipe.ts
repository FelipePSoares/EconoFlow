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

  transform(amount: number): string | null {
    const userProject = this.projectService.getSelectedUserProject();

    return this.currencyPipe.transform(amount, userProject?.project.preferredCurrency, "symbol", '1.2-2', this.globalService.languageLoaded);
  }
}
