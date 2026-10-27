import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { LoaderService } from '../../services/loader.service';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-spinner',
  imports: [
    AsyncPipe,
    TranslateDirective,
    TranslatePipe
],
  templateUrl: './spinner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./spinner.component.css']
})
export class SpinnerComponent {
  loader = inject(LoaderService);
  loading$ = this.loader.loading$;
}
