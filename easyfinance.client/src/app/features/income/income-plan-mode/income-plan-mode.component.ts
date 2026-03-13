import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DateAdapter } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router, UrlSegment } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, filter, map } from 'rxjs';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { Role } from '../../../core/enums/Role';
import { PlanType } from '../../../core/enums/plan-type';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { AddEditPlanComponent } from '../add-edit-plan/add-edit-plan.component';
import { AddPlanEntryComponent } from '../add-plan-entry/add-plan-entry.component';
import { PlanEntryDto } from '../models/plan-entry-dto';
import { PlanDto } from '../models/plan-dto';

@Component({
  selector: 'app-income-plan-mode',
  imports: [
    CommonModule,
    AsyncPipe,
    MatCardModule,
    ReturnButtonComponent,
    CurrencyFormatPipe,
    AddEditPlanComponent,
    AddPlanEntryComponent,
    TranslateModule
  ],
  templateUrl: './income-plan-mode.component.html',
  styleUrl: './income-plan-mode.component.css'
})
export class IncomePlanModeComponent implements OnInit {
  private hadModalOutlet = false;
  private planService = inject(PlanService);
  private router = inject(Router);
  private globalService = inject(GlobalService);
  private dialog = inject(MatDialog);
  private projectService = inject(ProjectService);
  private translateService = inject(TranslateService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private destroyRef = inject(DestroyRef);

  private plans = new BehaviorSubject<PlanDto[]>([]);
  private planEntries = new BehaviorSubject<PlanEntryDto[]>([]);

  plans$: Observable<PlanDto[]> = this.plans.asObservable();
  planEntries$: Observable<PlanEntryDto[]> = this.planEntries.asObservable();

  currentLanguage = this.globalService.currentLanguage;
  userProject!: UserProjectDto;
  selectedPlanId: string | null = null;
  isCreatingPlan = false;
  editingPlan: PlanDto | null = null;
  entrySelectedDate = this.currentDateService.currentDate;

  @Input({ required: true })
  projectId!: string;

  ngOnInit(): void {
    this.hadModalOutlet = this.hasModalOutlet(this.router.url);

    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
        this.dateAdapter.setLocale(event.lang);
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const hasModalOutlet = this.hasModalOutlet(event.urlAfterRedirects);

        if (this.hadModalOutlet && !hasModalOutlet && this.isCurrentIncomePlanRoute(event.urlAfterRedirects)) {
          this.loadPlans();
        }

        this.hadModalOutlet = hasModalOutlet;
      });

    this.projectService.selectedUserProject$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userProject => {
        if (userProject) {
          this.userProject = userProject;
          return;
        }

        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      });

    this.loadPlans();
  }

  get selectedPlan(): PlanDto | null {
    return this.plans.getValue().find(plan => plan.id === this.selectedPlanId) ?? null;
  }

  startCreatePlan(): void {
    if (!this.canAddOrEdit()) {
      return;
    }

    this.isCreatingPlan = true;
    this.editingPlan = null;
  }

  startEditPlan(plan: PlanDto): void {
    if (!this.canAddOrEdit()) {
      return;
    }

    this.isCreatingPlan = false;
    this.editingPlan = plan;
  }

  cancelPlanForm(): void {
    this.isCreatingPlan = false;
    this.editingPlan = null;
  }

  onPlanSaved(plan: PlanDto): void {
    this.cancelPlanForm();
    this.loadPlans(plan.id);
  }

  onPlanEntrySaved(entry: PlanEntryDto): void {
    this.loadPlans(entry.planId);
  }

  triggerArchivePlan(plan: PlanDto): void {
    if (!this.canAddOrEdit()) {
      return;
    }

    const message = this.translateService.instant('AreYouSureYouWantArchivePlan', { value: plan.name });
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'ArchivePlan', message, action: 'ButtonArchive' },
    }).afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.planService.archivePlan(this.projectId, plan.id).subscribe({
        next: () => {
          if (this.selectedPlanId === plan.id) {
            this.selectedPlanId = null;
          }

          this.loadPlans();
        }
      });
    });
  }

  selectPlan(planId: string): void {
    if (this.selectedPlanId === planId) {
      return;
    }

    this.selectedPlanId = planId;
    this.planEntries.next([]);
    this.loadPlanEntries(planId);
  }

  previous(): void {
    this.router.navigate(['/projects', this.projectId]);
  }

  canAddOrEdit(): boolean {
    return !!this.userProject && (this.userProject.role === Role.Admin || this.userProject.role === Role.Manager);
  }

  getPlanProgressValue(plan: PlanDto): number {
    return Math.round((Number(plan.progress || 0) * 100) * 10) / 10;
  }

  getPlanProgressWidth(plan: PlanDto): number {
    const progress = this.getPlanProgressValue(plan);
    return Math.max(0, Math.min(100, progress));
  }

  getPlanTypeLabel(planType: PlanType): string {
    return planType === PlanType.EmergencyReserve
      ? 'PlanTypeEmergencyReserve'
      : 'PlanTypeSaving';
  }

  private loadPlans(preferredPlanId?: string | null): void {
    this.planService.getPlans(this.projectId)
      .pipe(map(plans => PlanDto.fromPlans(plans)))
      .subscribe({
        next: plans => {
          this.plans.next(plans);

          if (plans.length === 0) {
            this.selectedPlanId = null;
            this.planEntries.next([]);
            return;
          }

          const nextSelectedPlanId = this.resolveSelectedPlanId(plans, preferredPlanId);
          this.selectedPlanId = nextSelectedPlanId;
          this.loadPlanEntries(nextSelectedPlanId);
        },
        error: () => {
          this.plans.next([]);
          this.selectedPlanId = null;
          this.planEntries.next([]);
        }
      });
  }

  private loadPlanEntries(planId: string): void {
    this.planService.getEntries(this.projectId, planId)
      .pipe(map(entries => PlanEntryDto.fromPlanEntries(entries)))
      .subscribe({
        next: entries => {
          this.planEntries.next(entries);
        },
        error: () => {
          this.planEntries.next([]);
        }
      });
  }

  private resolveSelectedPlanId(plans: PlanDto[], preferredPlanId?: string | null): string {
    if (preferredPlanId && plans.some(plan => plan.id === preferredPlanId)) {
      return preferredPlanId;
    }

    if (this.selectedPlanId && plans.some(plan => plan.id === this.selectedPlanId)) {
      return this.selectedPlanId;
    }

    return plans[0].id;
  }

  private hasModalOutlet(url: string): boolean {
    return !!this.router.parseUrl(url).root.children['modal'];
  }

  private isCurrentIncomePlanRoute(url: string): boolean {
    const primarySegments = this.router.parseUrl(url).root.children['primary']?.segments ?? [];
    const projectIdSegment = this.getSegmentPath(primarySegments, 1);

    return this.getSegmentPath(primarySegments, 0) === 'projects'
      && projectIdSegment === this.projectId
      && this.getSegmentPath(primarySegments, 2) === 'income-plans'
      && primarySegments.length === 3;
  }

  private getSegmentPath(segments: UrlSegment[], index: number): string {
    return segments.at(index)?.path ?? '';
  }
}
