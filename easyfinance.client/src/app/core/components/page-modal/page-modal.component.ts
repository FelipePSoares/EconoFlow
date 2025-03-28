import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-page-modal',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
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

  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private router: Router,
    private route: ActivatedRoute) {

    this.routeSub2 = this.router.events.subscribe(() => {
      const outletRoute = this.router.routerState.root.children.find(route => route.outlet === 'modal');
      this.title = outletRoute?.snapshot?.data['title'] || '';
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
