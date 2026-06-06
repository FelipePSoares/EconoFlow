/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of, EMPTY } from 'rxjs';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { ProjectService } from '../../../core/services/project.service';
import { ExpenseDto } from '../models/expense-dto';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ListExpensesComponent } from './list-expenses.component';

function makeExpense(overrides: Partial<ExpenseDto> = {}): ExpenseDto {
  const dto = new ExpenseDto();
  dto.id = overrides.id ?? 'expense-1';
  dto.name = overrides.name ?? 'Groceries';
  dto.date = overrides.date ?? new Date('2026-03-01');
  dto.amount = overrides.amount ?? 100;
  dto.budget = overrides.budget ?? 200;
  dto.items = overrides.items ?? [];
  dto.isDeductible = overrides.isDeductible ?? false;
  dto.attachments = overrides.attachments ?? [];
  dto.temporaryAttachmentIds = overrides.temporaryAttachmentIds ?? [];
  return dto;
}

function makeItem(overrides: Partial<ExpenseItemDto> = {}): ExpenseItemDto {
  const dto = new ExpenseItemDto();
  dto.id = overrides.id ?? 'item-1';
  dto.name = overrides.name ?? 'Bread';
  dto.date = overrides.date ?? new Date('2026-03-01');
  dto.amount = overrides.amount ?? 20;
  dto.isDeductible = overrides.isDeductible ?? false;
  dto.attachments = overrides.attachments ?? [];
  dto.temporaryAttachmentIds = overrides.temporaryAttachmentIds ?? [];
  dto.items = overrides.items ?? [];
  return dto;
}

describe('ListExpensesComponent', () => {
  let fixture: ComponentFixture<ListExpensesComponent>;
  let component: ListExpensesComponent;
  let expenseServiceMock: jasmine.SpyObj<ExpenseService>;
  let categoryServiceMock: jasmine.SpyObj<CategoryService>;
  let dialogMock: jasmine.SpyObj<MatDialog>;
  let snackBarMock: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    const routerEvents = new BehaviorSubject(new NavigationEnd(
      1,
      '/projects/project-1/categories/cat-1/expenses',
      '/projects/project-1/categories/cat-1/expenses'
    ));

    const routerMock = {
      url: '/projects/project-1/categories/cat-1/expenses',
      events: routerEvents.asObservable(),
      navigate: jasmine.createSpy('navigate'),
      parseUrl: (url: string) => {
        const segments = url.split('?')[0].split('/').filter(Boolean).map(path => ({ path }));
        return {
          root: {
            children: {
              primary: { segments }
            }
          }
        } as unknown as ReturnType<Router['parseUrl']>;
      }
    } as unknown as Router;

    expenseServiceMock = jasmine.createSpyObj<ExpenseService>('ExpenseService', [
      'get', 'remove', 'restore', 'removeItem', 'restoreItem'
    ]);
    expenseServiceMock.get.and.returnValue(of([]));
    expenseServiceMock.remove.and.returnValue(of(true));
    expenseServiceMock.restore.and.returnValue(of(true));
    expenseServiceMock.removeItem.and.returnValue(of(true));
    expenseServiceMock.restoreItem.and.returnValue(of(true));

    categoryServiceMock = jasmine.createSpyObj<CategoryService>('CategoryService', ['getById']);
    categoryServiceMock.getById.and.returnValue(of({ id: 'cat-1', name: 'Food', isArchived: false } as any));

    snackBarMock = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    snackBarMock.open.and.returnValue({ onAction: () => EMPTY } as any);

    dialogMock = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialogMock.open.and.returnValue({ afterClosed: () => of(false) } as any);

    await TestBed.configureTestingModule({
      imports: [
        ListExpensesComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideNativeDateAdapter(),
        { provide: Router, useValue: routerMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: ExpenseService, useValue: expenseServiceMock },
        { provide: CategoryService, useValue: categoryServiceMock },
        {
          provide: ProjectService,
          useValue: {
            selectedUserProject$: of({ role: 'Admin', project: { id: 'project-1', name: 'Project One' } }),
            getUserProject: () => of({ role: 'Admin', project: { id: 'project-1', name: 'Project One' } }),
            selectUserProject: jasmine.createSpy('selectUserProject')
          }
        },
        {
          provide: GlobalService,
          useValue: {
            currentLanguage: 'en',
            currency: 'USD',
            currencySymbol: '$',
            groupSeparator: ',',
            decimalSeparator: '.'
          }
        },
        {
          provide: CurrentDateService,
          useValue: { currentDate: new Date('2026-03-12T12:00:00') }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListExpensesComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    component.categoryId = 'cat-1';
    fixture.detectChanges();
  });

  it('should load expenses on init', () => {
    expect(expenseServiceMock.get).toHaveBeenCalledWith('project-1', 'cat-1', jasmine.any(Date));
  });

  describe('swipeDeleteExpense', () => {
    it('should optimistically remove the expense from the list', () => {
      const expense = makeExpense();
      (component as any).expenses.next([expense]);

      component.swipeDeleteExpense(expense);

      const remaining = (component as any).expenses.getValue() as ExpenseDto[];
      expect(remaining.find(e => e.id === 'expense-1')).toBeUndefined();
    });

    it('should call the remove API', () => {
      const expense = makeExpense();
      (component as any).expenses.next([expense]);

      component.swipeDeleteExpense(expense);

      expect(expenseServiceMock.remove).toHaveBeenCalledWith('project-1', 'cat-1', 'expense-1');
    });

    it('should show a snackbar with undo action', () => {
      const expense = makeExpense();
      (component as any).expenses.next([expense]);

      component.swipeDeleteExpense(expense);

      expect(snackBarMock.open).toHaveBeenCalled();
    });

    it('should call restore API and refill data when undo is clicked', () => {
      const actionSubject = new Subject<void>();
      snackBarMock.open.and.returnValue({ onAction: () => actionSubject.asObservable() } as any);

      const expense = makeExpense();
      (component as any).expenses.next([expense]);

      component.swipeDeleteExpense(expense);
      actionSubject.next();

      expect(expenseServiceMock.restore).toHaveBeenCalledWith('project-1', 'cat-1', 'expense-1');
      expect(expenseServiceMock.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('swipeDeleteSubExpense', () => {
    it('should optimistically remove the sub-expense from the parent', () => {
      const item = makeItem();
      const expense = makeExpense({ items: [item] });
      (component as any).expenses.next([expense]);

      component.swipeDeleteSubExpense(expense, item);

      const remaining = (component as any).expenses.getValue() as ExpenseDto[];
      expect(remaining[0].items.find(i => i.id === 'item-1')).toBeUndefined();
    });

    it('should call the removeItem API', () => {
      const item = makeItem();
      const expense = makeExpense({ items: [item] });
      (component as any).expenses.next([expense]);

      component.swipeDeleteSubExpense(expense, item);

      expect(expenseServiceMock.removeItem).toHaveBeenCalledWith('project-1', 'cat-1', 'expense-1', 'item-1');
    });

    it('should show a snackbar with undo action', () => {
      const item = makeItem();
      const expense = makeExpense({ items: [item] });
      (component as any).expenses.next([expense]);

      component.swipeDeleteSubExpense(expense, item);

      expect(snackBarMock.open).toHaveBeenCalled();
    });

    it('should call restoreItem API and refill data when undo is clicked', () => {
      const actionSubject = new Subject<void>();
      snackBarMock.open.and.returnValue({ onAction: () => actionSubject.asObservable() } as any);

      const item = makeItem();
      const expense = makeExpense({ items: [item] });
      (component as any).expenses.next([expense]);

      component.swipeDeleteSubExpense(expense, item);
      actionSubject.next();

      expect(expenseServiceMock.restoreItem).toHaveBeenCalledWith('project-1', 'cat-1', 'expense-1', 'item-1');
      expect(expenseServiceMock.get).toHaveBeenCalledTimes(2);
    });
  });
});
