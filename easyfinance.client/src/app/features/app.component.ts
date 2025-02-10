import { Component } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from '../core/components/nav-bar/nav-bar.component';
import { SpinnerComponent } from '../core/components/spinner/spinner.component';
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import * as moment from 'moment';

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
    selector: 'app-root',
    imports: [
        CommonModule,
        RouterOutlet,
        NavBarComponent,
        SpinnerComponent,
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    providers: [
        { provide: MAT_MOMENT_DATE_ADAPTER_OPTIONS, useValue: { useUtc: true } },
        {
            provide: DateAdapter,
            useClass: MomentDateAdapter,
            deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
        },
        { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
    ]
})

export class AppComponent {

  constructor(public authService: AuthService) {
    if (this.authService.isSignedIn$){
      this.authService.startUserPolling();
    }
   }
}
