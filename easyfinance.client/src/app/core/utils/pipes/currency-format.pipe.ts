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
    const project = this.projectService.getSelectedProject();

    return this.currencyPipe.transform(amount, project?.preferredCurrency, "symbol", '1.2-2', this.globalService.languageLoaded);
  }
}
