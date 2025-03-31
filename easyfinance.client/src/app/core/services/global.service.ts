import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { getCurrencySymbol } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  public languageLoaded = 'en-US';
  public groupSeparator = '.';
  public decimalSeparator = ',';

  constructor(private projectService: ProjectService) { }

  get currencySymbol(): string {
    const currency = this.projectService.getSelectedUserProject()?.project?.preferredCurrency;

    return getCurrencySymbol(currency ?? 'EUR', "narrow");
  }
}
