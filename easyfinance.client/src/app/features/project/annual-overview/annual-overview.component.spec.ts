import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CurrencyPipe } from '@angular/common';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AnnualOverviewComponent } from './annual-overview.component';
import { ProjectService } from '../../../core/services/project.service';
import { IncomeService } from '../../../core/services/income.service';
import { CategoryService } from '../../../core/services/category.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';

describe('AnnualOverviewComponent', () => {
  let fixture: ComponentFixture<AnnualOverviewComponent>;
  let component: AnnualOverviewComponent;
  let projectServiceMock: jasmine.SpyObj<ProjectService>;
  let categoryServiceMock: jasmine.SpyObj<CategoryService>;
  let incomeServiceMock: jasmine.SpyObj<IncomeService>;
  let routerMock: jasmine.SpyObj<Router>;
  let routeStub: { queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>> };

  beforeEach(async () => {
    routeStub = {
      queryParamMap: new BehaviorSubject(convertToParamMap({ year: '2026' }))
    };

    projectServiceMock = jasmine.createSpyObj<ProjectService>(
      'ProjectService',
      ['getUserProject', 'selectUserProject', 'getYearlyInfo', 'getAnnualExpensesByCategory'],
      { selectedUserProject$: of(undefined) }
    );

    categoryServiceMock = jasmine.createSpyObj<CategoryService>('CategoryService', ['get']);
    incomeServiceMock = jasmine.createSpyObj<IncomeService>('IncomeService', ['get']);
    routerMock = jasmine.createSpyObj<Router>('Router', ['navigate']);

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
        expenses: [
          {
            id: 'expense-1',
            name: 'Deductible Expense',
            date: '2026-02-10',
            amount: 110,
            isDeductible: true,
            items: []
          },
          {
            id: 'expense-2',
            name: 'Parent Expense',
            date: '2026-02-12',
            amount: 90,
            isDeductible: false,
            items: [
              {
                id: 'expense-item-1',
                name: 'Deductible Item',
                date: '2026-02-13',
                amount: 45,
                isDeductible: true
              }
            ]
          }
        ]
      }
    ] as any));

    incomeServiceMock.get.and.returnValue(of([] as any));

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
          provide: Router,
          useValue: routerMock
        },
        {
          provide: ActivatedRoute,
          useValue: routeStub
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

  it('should reload data when year changes from query params', () => {
    expect(projectServiceMock.getYearlyInfo).toHaveBeenCalledWith('project-1', 2026);

    routeStub.queryParamMap.next(convertToParamMap({ year: '2025' }));
    fixture.detectChanges();

    expect(projectServiceMock.getYearlyInfo).toHaveBeenCalledWith('project-1', 2025);
  });

  it('should calculate and render total deductible amount', () => {
    const deductibleAmount = fixture.nativeElement.querySelector('[data-testid="deductible-total-amount"]');

    expect(component.totalDeductibleAmount).toBe(155);
    expect(deductibleAmount).not.toBeNull();
    expect(deductibleAmount.textContent).toContain('155');
  });

  it('should navigate to deductions page', () => {
    component.openDeductions();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'deductions']);
  });

  it('should flag deductible load failure and reset totals when category loading fails', () => {
    categoryServiceMock.get.and.returnValue(throwError(() => new Error('load failed')));

    routeStub.queryParamMap.next(convertToParamMap({ year: '2025' }));
    fixture.detectChanges();

    expect(component.deductibleLoadFailed).toBeTrue();
    expect(component.totalDeductibleAmount).toBe(0);
  });
});
