import { Component, inject, ViewEncapsulation } from '@angular/core';
import { LoaderService } from '../../services/loader.service';
import { faCoins, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-spinner',
  imports: [
    AsyncPipe,
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
  loader = inject(LoaderService);
  loading$ = this.loader.loading$;
}
