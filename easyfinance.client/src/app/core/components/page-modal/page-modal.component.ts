
import { Component, Inject, OnDestroy, Optional } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-page-modal',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogContent,
    RouterOutlet,
    TranslateModule
],
  templateUrl: './page-modal.component.html',
  styleUrl: './page-modal.component.css'
})
export class PageModalComponent implements OnDestroy {
  private routeSub: Subscription;
  private routeSub2: Subscription;

  title = '';
  titleSuffix = '';
  hasClose = true;

  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private router: Router,
    private route: ActivatedRoute,
    @Optional() @Inject(MAT_DIALOG_DATA) private dialogData?: { titleSuffix?: string }) {

    this.routeSub2 = this.router.events.subscribe(() => {
      const outletRoute = this.router.routerState.root.children.find(route => route.outlet === 'modal');
      this.title = outletRoute?.snapshot?.data['title'] || '';
      this.titleSuffix = this.dialogData?.titleSuffix?.trim() ?? '';
      this.hasClose = outletRoute?.snapshot?.data['hasCloseButton'] ?? true;
      this.dialogRef.disableClose = !this.hasClose;
    });

    this.routeSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      if (!this.route.children.some(child => child.outlet === 'modal')) {
        this.close(true);
      }
    });
  }

  close(isSuccess: boolean): void {
    this.dialogRef.close(isSuccess);
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.routeSub2.unsubscribe();
  }
}
