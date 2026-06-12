import { NgComponentOutlet } from '@angular/common';
import { Component, OnDestroy, Type, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';

export interface PageModalDialogData {
  titleSuffix?: string;
  title?: string;
  hasCloseButton?: boolean;
  component?: Type<unknown>;
  componentInputs?: Record<string, unknown>;
}

@Component({
  selector: 'app-page-modal',
  imports: [
    NgComponentOutlet,
    MatButtonModule,
    MatIconModule,
    MatDialogContent,
    RouterOutlet,
    TranslateModule
],
  templateUrl: './page-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './page-modal.component.css'
})
export class PageModalComponent implements OnDestroy {
  private dialogRef = inject<MatDialogRef<PageModalComponent>>(MatDialogRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialogData = inject<PageModalDialogData>(MAT_DIALOG_DATA, { optional: true });

  private routeSub?: Subscription;
  private routeSub2?: Subscription;

  title = '';
  titleSuffix = '';
  hasClose = true;
  component: Type<unknown> | null = null;
  componentInputs: Record<string, unknown> = {};

  constructor() {
    this.component = this.dialogData?.component ?? null;
    this.componentInputs = this.dialogData?.componentInputs ?? {};
    this.titleSuffix = this.dialogData?.titleSuffix?.trim() ?? '';

    if (this.component) {
      this.title = this.dialogData?.title ?? '';
      this.hasClose = this.dialogData?.hasCloseButton ?? true;
      this.dialogRef.disableClose = !this.hasClose;
      return;
    }

    this.routeSub2 = this.router.events.subscribe(() => {
      const outletRoute = this.router.routerState.root.children.find(route => route.outlet === 'modal');
      this.title = outletRoute?.snapshot?.data['title'] || '';
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
    this.routeSub?.unsubscribe();
    this.routeSub2?.unsubscribe();
  }
}
