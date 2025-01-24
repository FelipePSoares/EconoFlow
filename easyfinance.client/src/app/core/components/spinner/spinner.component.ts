import { Component, ViewEncapsulation } from '@angular/core';
import { LoaderService } from '../../services/loader.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-spinner',
    imports: [CommonModule],
    templateUrl: './spinner.component.html',
    styleUrls: ['./spinner.component.css'],
    encapsulation: ViewEncapsulation.ShadowDom
})
export class SpinnerComponent {
  constructor(public loader: LoaderService) { }
}
