import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetLineComponent } from './budget-line.component';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

describe('BudgetLineComponent', () => {
  let component: BudgetLineComponent;
  let fixture: ComponentFixture<BudgetLineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        BaseChartDirective,
        TranslateModule.forRoot()
      ],
      declarations: [BudgetLineComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetLineComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Cumulative calculation', () => {
    it('should calculate cumulative spending correctly from daily totals', () => {
      component.dailyTotals = [
        { date: '2025-01-01', amount: 10 },
        { date: '2025-01-02', amount: 15 },
        { date: '2025-01-03', amount: 5 },
        { date: '2025-01-05', amount: 20 } // Missing day 4
      ];
      component.budget = 100;

      component.ngOnInit();

      expect(component.lineChartData.datasets[0].data).toEqual([10, 25, 30, 30, 50]);
    });

    it('should calculate cumulative spending correctly from transactions', () => {
      component.transactions = [
        { id: 1, date: '2025-01-01T10:00:00Z', amount: 25 },
        { id: 2, date: '2025-01-01T14:00:00Z', amount: 15 },
        { id: 3, date: '2025-01-02T09:00:00Z', amount: 30 },
        { id: 4, date: '2025-01-04T16:00:00Z', amount: 10 } // Missing day 3
      ];
      component.budget = 200;

      component.ngOnInit();

      expect(component.lineChartData.datasets[0].data).toEqual([40, 70, 70, 80]);
    });

    it('should handle empty data gracefully', () => {
      component.dailyTotals = [];
      component.budget = 100;

      component.ngOnInit();

      expect(component.lineChartData.datasets[0].data).toEqual([]);
    });

    it('should handle missing days as zero spending', () => {
      component.dailyTotals = [
        { date: '2025-01-01', amount: 50 },
        { date: '2025-01-10', amount: 25 } // Big gap in days
      ];
      component.budget = 200;

      component.ngOnInit();

      // Should have 31 days (January), with cumulative increasing only on days 1 and 10
      const expectedData = new Array(31).fill(0).map((_, index) => {
        const day = index + 1;
        if (day === 1) return 50;
        if (day === 10) return 75;
        return day < 10 ? 50 : 75;
      });

      expect(component.lineChartData.datasets[0].data).toEqual(expectedData);
    });
  });

  describe('Budget line', () => {
    it('should create horizontal budget line at correct value', () => {
      component.dailyTotals = [
        { date: '2025-01-01', amount: 10 },
        { date: '2025-01-02', amount: 20 }
      ];
      component.budget = 150;

      component.ngOnInit();

      // Budget should be constant throughout the month
      expect(component.lineChartData.datasets[1].data.every(value => value === 150)).toBe(true);
      expect(component.lineChartData.datasets[1].data.length).toBe(31); // January has 31 days
    });
  });

  describe('Date handling', () => {
    it('should determine correct days in month for different months', () => {
      component.month = '2025-02'; // February 2025 (28 days)
      component.dailyTotals = [];
      component.budget = 100;

      component.ngOnInit();

      expect(component.getDaysInMonth()).toBe(28);
    });

    it('should handle leap year February', () => {
      component.month = '2024-02'; // February 2024 (29 days, leap year)
      component.dailyTotals = [];
      component.budget = 100;

      component.ngOnInit();

      expect(component.getDaysInMonth()).toBe(29);
    });

    it('should handle 31-day months', () => {
      component.month = '2025-01'; // January (31 days)
      component.dailyTotals = [];
      component.budget = 100;

      component.ngOnInit();

      expect(component.getDaysInMonth()).toBe(31);
    });

    it('should handle 30-day months', () => {
      component.month = '2025-04'; // April (30 days)
      component.dailyTotals = [];
      component.budget = 100;

      component.ngOnInit();

      expect(component.getDaysInMonth()).toBe(30);
    });
  });

  describe('Accessibility', () => {
    it('should provide meaningful aria label', () => {
      component.budget = 500;
      component.month = '2025-01';

      const ariaLabel = component.getAriaLabel();

      expect(ariaLabel).toContain('Budget line chart');
      expect(ariaLabel).toContain('31 days');
      expect(ariaLabel).toContain('$500');
    });
  });

  describe('Input validation', () => {
    it('should use transactions when both dailyTotals and transactions are provided', () => {
      component.dailyTotals = [{ date: '2025-01-01', amount: 100 }];
      component.transactions = [{ id: 1, date: '2025-01-01T10:00:00Z', amount: 50 }];
      component.budget = 200;

      component.ngOnInit();

      // Should use transactions (50) not dailyTotals (100)
      expect(component.lineChartData.datasets[0].data[0]).toBe(50);
    });

    it('should handle negative amounts from transactions', () => {
      component.transactions = [
        { id: 1, date: '2025-01-01T10:00:00Z', amount: -25 }, // Negative amount
        { id: 2, date: '2025-01-02T10:00:00Z', amount: 30 }
      ];
      component.budget = 100;

      component.ngOnInit();

      // Should use absolute value (25) not negative
      expect(component.lineChartData.datasets[0].data[0]).toBe(25);
      expect(component.lineChartData.datasets[0].data[1]).toBe(55);
    });
  });
});
