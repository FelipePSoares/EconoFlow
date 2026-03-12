import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { IncomeService } from '../../../core/services/income.service';
import { ProjectService } from '../../../core/services/project.service';
import { ListIncomesComponent } from './list-incomes.component';

describe('ListIncomesComponent', () => {
  let fixture: ComponentFixture<ListIncomesComponent>;
  let component: ListIncomesComponent;
  let incomeServiceMock: jasmine.SpyObj<IncomeService>;

  beforeEach(async () => {
    const routerEvents = new BehaviorSubject(new NavigationEnd(
      1,
      '/projects/project-1/incomes',
      '/projects/project-1/incomes'
    ));

    const routerMock = {
      url: '/projects/project-1/incomes',
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

    incomeServiceMock = jasmine.createSpyObj<IncomeService>('IncomeService', ['get', 'remove']);
    incomeServiceMock.get.and.returnValue(of([
      {
        id: 'income-1',
        name: 'Salary',
        amount: 1200,
        date: new Date('2026-03-01')
      }
    ]));
    incomeServiceMock.remove.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [
        ListIncomesComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideNativeDateAdapter(),
        {
          provide: Router,
          useValue: routerMock
        },
        {
          provide: MatDialog,
          useValue: {
            open: () => ({
              afterClosed: () => of(false)
            })
          }
        },
        {
          provide: IncomeService,
          useValue: incomeServiceMock
        },
        {
          provide: ProjectService,
          useValue: {
            selectedUserProject$: of({
              role: 'Admin',
              project: { id: 'project-1', name: 'Project One' }
            }),
            getUserProject: () => of({
              role: 'Admin',
              project: { id: 'project-1', name: 'Project One' }
            }),
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
          useValue: {
            currentDate: new Date('2026-03-12T12:00:00')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListIncomesComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should load incomes on init', () => {
    expect(incomeServiceMock.get).toHaveBeenCalledWith('project-1', jasmine.any(Date));
  });

  it('should enter create-income mode', () => {
    component.startCreateIncome();

    expect(component.isCreatingIncome).toBeTrue();
    expect(component.editingIncomeId).toBeNull();
  });

  it('should reload incomes after income is saved', () => {
    component.onIncomeSaved();

    expect(incomeServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('should reload data for selected date', () => {
    component.updateDate(new Date('2026-04-01T12:00:00'));

    expect(incomeServiceMock.get).toHaveBeenCalledTimes(2);
  });
});
