import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { getCurrencySymbol } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  public languageLoaded: string = 'en-US';
  public groupSeparator: string = '.';
  public decimalSeparator: string = ',';
  public currencySymbol: string = getCurrencySymbol(this.projectService.getSelectedUserProject()?.project?.preferredCurrency ?? 'EUR', "narrow");

  constructor(private projectService: ProjectService) { }
}
