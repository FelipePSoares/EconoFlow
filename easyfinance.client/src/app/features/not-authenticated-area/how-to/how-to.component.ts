import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-how-to',
  imports: [],
  templateUrl: './how-to.component.html',
  styleUrl: './how-to.component.css'
})
export class HowToComponent implements OnDestroy {
  private routeSub: Subscription;

  public content = '';

  constructor(private route: ActivatedRoute, private translate: TranslateService) {
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
