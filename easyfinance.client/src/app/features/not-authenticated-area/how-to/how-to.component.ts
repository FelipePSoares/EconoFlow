import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-how-to',
  imports: [],
  templateUrl: './how-to.component.html',
  styleUrl: './how-to.component.css'
})
export class HowToComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  private routeSub: Subscription;

  public content = '';

  constructor() {
    const translate = this.translate;

    this.routeSub = this.route.data.subscribe(data => {
      const contentKey = data['content'] || '';
      translate.get('how-to-' + contentKey).subscribe((translation: string) => {
        this.content = translation;
      })
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }
}
