import { Component, Inject, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-page-modal',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    RouterOutlet
  ],
  templateUrl: './page-modal.component.html',
  styleUrl: './page-modal.component.css'
})
export class PageModalComponent implements OnDestroy {
  private routeSub: Subscription;
  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; }) {

    this.routeSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
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
  }
}
