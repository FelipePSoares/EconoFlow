import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { IncomeService } from 'src/app/core/services/income.service';
import { IncomeDto } from '../models/income-dto';
import { AsyncPipe, CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatCardModule } from '@angular/material/card';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { GlobalService } from '../../../core/services/global.service';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../../core/services/project.service';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { Role } from '../../../core/enums/Role';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { DateAdapter } from '@angular/material/core';
import { AddIncomeComponent } from '../add-income/add-income.component';

@Component({
    selector: 'app-list-incomes',
    imports: [
        CommonModule,
        AsyncPipe,
        MatCardModule,
        ReturnButtonComponent,
        CurrentDateComponent,
        CurrencyFormatPipe,
        AddIncomeComponent,
        TranslateModule
    ],
    templateUrl: './list-incomes.component.html',
    styleUrl: './list-incomes.component.css'
})

export class ListIncomesComponent implements OnInit {
  private incomeService = inject(IncomeService);
  private router = inject(Router);
  private globalService = inject(GlobalService);
  private dialog = inject(MatDialog);
  private projectService = inject(ProjectService);
  private translateService = inject(TranslateService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private destroyRef = inject(DestroyRef);

  private incomes: BehaviorSubject<IncomeDto[]> = new BehaviorSubject<IncomeDto[]>([]);
  incomes$: Observable<IncomeDto[]> = this.incomes.asObservable();
  isCreatingIncome = false;
  editingIncomeId: string | null = null;
  itemToDelete!: string;
  currentLanguage = this.globalService.currentLanguage;
  userProject!: UserProjectDto;

  @Input({ required: true })
  projectId!: string;

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
        this.dateAdapter.setLocale(event.lang);
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

    this.fillData(this.currentDateService.currentDate);
  }

  fillData(date: Date): void {
    this.incomeService.get(this.projectId, date)
      .pipe(map(incomes => IncomeDto.fromIncomes(incomes)))
      .subscribe({
        next: res => this.incomes.next(res)
      });
  }

  startCreateIncome(): void {
    if (!this.canAddOrEdit()) {
      return;
    }

    this.editingIncomeId = null;
    this.isCreatingIncome = true;
  }

  startEditIncome(income: IncomeDto): void {
    if (!this.canAddOrEdit()) {
      return;
    }

    this.isCreatingIncome = false;
    this.editingIncomeId = income.id;
  }

  cancelIncomeForm(): void {
    this.isCreatingIncome = false;
    this.editingIncomeId = null;
  }

  onIncomeSaved(): void {
    this.cancelIncomeForm();
    this.fillData(this.currentDateService.currentDate);
  }

  isEditingIncome(income: IncomeDto): boolean {
    return this.editingIncomeId === income.id;
  }

  remove(id: string): void {
    this.incomeService.remove(this.projectId, id).subscribe({
      next: () => {
        const incomesNewArray = this.incomes
          .getValue()
          .filter(item => item.id !== id);
        this.incomes.next(incomesNewArray);
      }
    });
  }

  triggerDelete(income: IncomeDto): void {
    this.itemToDelete = income.id;
    const message = this.translateService.instant('AreYouSureYouWantDeleteIncome', { value: income.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteIncome', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.remove(this.itemToDelete);
      }
    });
  }

  updateDate(newDate: Date) {
    this.resetEditionState();
    this.fillData(newDate);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId]);
  }

  canAddOrEdit(): boolean {
    return !!this.userProject && (this.userProject.role === Role.Admin || this.userProject.role === Role.Manager);
  }

  private resetEditionState(): void {
    this.cancelIncomeForm();
  }
}
