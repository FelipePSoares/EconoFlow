import { Component, ViewEncapsulation } from '@angular/core';
import { LoaderService } from '../../services/loader.service';
import { CommonModule } from '@angular/common';
import { faCoins, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-spinner',
  imports: [
    CommonModule,
    FontAwesomeModule,
    TranslateModule
  ],
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.css'],
  encapsulation: ViewEncapsulation.ShadowDom
})
export class SpinnerComponent {
  faCoins = faCoins;
  faChartPie = faChartPie;

  constructor(public loader: LoaderService) { }
}
