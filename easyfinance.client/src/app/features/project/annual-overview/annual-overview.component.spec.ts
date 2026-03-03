import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CurrencyPipe } from '@angular/common';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { of, BehaviorSubject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AnnualOverviewComponent } from './annual-overview.component';
import { ProjectService } from '../../../core/services/project.service';
import { IncomeService } from '../../../core/services/income.service';
import { CategoryService } from '../../../core/services/category.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { AttachmentType } from '../../../core/enums/attachment-type';

describe('AnnualOverviewComponent', () => {
  let fixture: ComponentFixture<AnnualOverviewComponent>;
  let component: AnnualOverviewComponent;
  let projectServiceMock: jasmine.SpyObj<ProjectService>;
  let categoryServiceMock: jasmine.SpyObj<CategoryService>;
  let incomeServiceMock: jasmine.SpyObj<IncomeService>;
  let expenseServiceMock: jasmine.SpyObj<ExpenseService>;
  let routerMock: jasmine.SpyObj<Router>;
  let dialogMock: jasmine.SpyObj<MatDialog>;
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({ year: '2026' }));

    projectServiceMock = jasmine.createSpyObj<ProjectService>(
      'ProjectService',
      ['getUserProject', 'selectUserProject', 'getYearlyInfo', 'getAnnualExpensesByCategory'],
      { selectedUserProject$: of(undefined) }
    );

    categoryServiceMock = jasmine.createSpyObj<CategoryService>('CategoryService', ['get']);
    incomeServiceMock = jasmine.createSpyObj<IncomeService>('IncomeService', ['get']);
    expenseServiceMock = jasmine.createSpyObj<ExpenseService>('ExpenseService', ['getAttachmentDownloadUrl', 'getExpenseItemAttachmentDownloadUrl']);
    routerMock = jasmine.createSpyObj<Router>('Router', ['navigate']);
    dialogMock = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialogMock.open.and.returnValue({
      afterClosed: () => of(true)
    } as any);

    projectServiceMock.getUserProject.and.returnValue(of({
      project: { id: 'project-1', name: 'Test Project' }
    } as any));
    projectServiceMock.getYearlyInfo.and.returnValue(of({
      totalSpend: 300,
      totalOverspend: 20,
      totalEarned: 1000
    } as any));
    projectServiceMock.getAnnualExpensesByCategory.and.returnValue(of([
      { name: 'Category A', amount: 320 }
    ] as any));

    categoryServiceMock.get.and.returnValue(of([
      {
        id: 'category-1',
        name: 'Category A',
        isArchived: false,
        expenses: [
          {
            id: 'expense-1',
            name: 'Deductible Expense With Proof',
            date: '2026-02-10',
            amount: 110,
            budget: 150,
            isDeductible: true,
            attachments: [
              {
                id: 'proof-1',
                name: 'proof.pdf',
                contentType: 'application/pdf',
                size: 123,
                attachmentType: AttachmentType.DeductibleProof,
                isTemporary: false
              }
            ],
            temporaryAttachmentIds: [],
            items: []
          },
          {
            id: 'expense-2',
            name: 'Parent Expense',
            date: '2026-02-12',
            amount: 90,
            budget: 100,
            isDeductible: false,
            attachments: [],
            temporaryAttachmentIds: [],
            items: [
              {
                id: 'expense-item-1',
                name: 'Deductible Item Without Proof',
                date: '2026-02-13',
                amount: 45,
                isDeductible: true,
                attachments: [],
                temporaryAttachmentIds: [],
                items: []
              }
            ]
          }
        ]
      }
    ] as any));

    incomeServiceMock.get.and.returnValue(of([] as any));
    expenseServiceMock.getAttachmentDownloadUrl.and.returnValue('/api/projects/project-1/categories/category-1/expenses/expense-1/attachments/proof-1');
    expenseServiceMock.getExpenseItemAttachmentDownloadUrl.and.returnValue('/api/projects/project-1/categories/category-1/expenses/expense-2/expenseItems/expense-item-1/attachments/item-proof-1');

    await TestBed.configureTestingModule({
      imports: [
        AnnualOverviewComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: ProjectService,
          useValue: projectServiceMock
        },
        {
          provide: CategoryService,
          useValue: categoryServiceMock
        },
        {
          provide: IncomeService,
          useValue: incomeServiceMock
        },
        {
          provide: ExpenseService,
          useValue: expenseServiceMock
        },
        {
          provide: Router,
          useValue: routerMock
        },
        {
          provide: MatDialog,
          useValue: dialogMock
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap$.asObservable()
          }
        },
        {
          provide: GlobalService,
          useValue: {
            currentLanguage: 'en',
            currency: 'USD',
            groupSeparator: ',',
            decimalSeparator: '.'
          }
        },
        {
          provide: CurrentDateService,
          useValue: {
            currentDate: new Date('2026-03-01T12:00:00')
          }
        },
        CurrencyPipe,
        provideNativeDateAdapter()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnualOverviewComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should reload data when year changes from selector/query', () => {
    expect(projectServiceMock.getYearlyInfo).toHaveBeenCalledWith('project-1', 2026);

    queryParamMap$.next(convertToParamMap({ year: '2025' }));
    fixture.detectChanges();

    expect(projectServiceMock.getYearlyInfo).toHaveBeenCalledWith('project-1', 2025);
  });

  it('should render deductible expenses table', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="deductible-table"] tbody tr');

    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Deductible Expense With Proof');
    expect(fixture.nativeElement.textContent).toContain('Deductible Item Without Proof');
  });

  it('should render proof indicator for attached and missing proof', () => {
    const withProof = fixture.nativeElement.querySelectorAll('[data-testid="deductible-proof-yes"]');
    const withoutProof = fixture.nativeElement.querySelectorAll('[data-testid="deductible-proof-no"]');

    expect(withProof.length).toBe(1);
    expect(withoutProof.length).toBe(1);
  });

  it('should open deductible expense in expense modal edit mode', () => {
    const deductibleExpense = component.deductibleExpenses.find(item => !item.expenseItemId)!;

    component.openDeductibleExpense(deductibleExpense);

    expect(routerMock.navigate).toHaveBeenCalledWith(
      [{ outlets: { modal: ['projects', 'project-1', 'add-expense'] } }],
      {
        queryParams: {
          categoryId: deductibleExpense.categoryId,
          expenseId: deductibleExpense.expenseId,
          expenseItemId: null
        },
        queryParamsHandling: 'merge'
      }
    );
    expect(dialogMock.open).toHaveBeenCalled();
  });

  it('should open deductible expense item in expense-item modal edit mode', () => {
    const deductibleExpenseItem = component.deductibleExpenses.find(item => !!item.expenseItemId)!;

    component.openDeductibleExpense(deductibleExpenseItem);

    expect(routerMock.navigate).toHaveBeenCalledWith(
      [{ outlets: { modal: ['projects', 'project-1', 'add-expense-item'] } }],
      {
        queryParams: {
          categoryId: deductibleExpenseItem.categoryId,
          expenseId: deductibleExpenseItem.expenseId,
          expenseItemId: deductibleExpenseItem.expenseItemId
        },
        queryParamsHandling: 'merge'
      }
    );
    expect(dialogMock.open).toHaveBeenCalled();
  });
});
