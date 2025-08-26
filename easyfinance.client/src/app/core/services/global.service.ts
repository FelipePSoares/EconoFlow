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
  private currency: string | undefined;

  constructor(private projectService: ProjectService) {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      this.currency = userProject?.project.preferredCurrency;
    });
  }

  get currencySymbol(): string {
    return getCurrencySymbol(this.currency ?? 'EUR', "narrow");
  }
}
