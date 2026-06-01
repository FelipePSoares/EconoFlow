import {
  toDateOnly,
  fromDateOnly,
  monthStart,
  monthEnd,
  prevMonth,
  nextMonth,
  currentMonth,
  formatMonthLabel,
} from '../date';

describe('toDateOnly', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2024, 0, 15))).toBe('2024-01-15');
  });

  it('formats a date string as YYYY-MM-DD', () => {
    expect(toDateOnly('2024-06-01')).toBe('2024-06-01');
  });

  it('zero-pads month and day', () => {
    expect(toDateOnly(new Date(2024, 2, 5))).toBe('2024-03-05');
  });
});

describe('fromDateOnly', () => {
  it('parses a YYYY-MM-DD string to a local Date', () => {
    const d = fromDateOnly('2024-03-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it('round-trips with toDateOnly', () => {
    const original = '2024-12-31';
    expect(toDateOnly(fromDateOnly(original))).toBe(original);
  });
});

describe('monthStart', () => {
  it('returns the first day of the given month', () => {
    expect(monthStart('2024-03')).toBe('2024-03-01');
  });

  it('handles December', () => {
    expect(monthStart('2024-12')).toBe('2024-12-01');
  });
});

describe('monthEnd', () => {
  it('returns the first day of the following month (exclusive upper bound)', () => {
    expect(monthEnd('2024-03')).toBe('2024-04-01');
  });

  it('wraps correctly at year boundary', () => {
    expect(monthEnd('2024-12')).toBe('2025-01-01');
  });
});

describe('prevMonth', () => {
  it('returns the previous month', () => {
    expect(prevMonth('2024-03')).toBe('2024-02');
  });

  it('wraps correctly at year boundary', () => {
    expect(prevMonth('2024-01')).toBe('2023-12');
  });
});

describe('nextMonth', () => {
  it('returns the next month', () => {
    expect(nextMonth('2024-03')).toBe('2024-04');
  });

  it('wraps correctly at year boundary', () => {
    expect(nextMonth('2024-12')).toBe('2025-01');
  });
});

describe('currentMonth', () => {
  it('returns a string in YYYY-MM format', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('formatMonthLabel', () => {
  it('formats a month string as "Month YYYY"', () => {
    // Dayjs uses the locale — test structural shape, not locale-specific text
    const label = formatMonthLabel('2024-01');
    expect(label).toMatch(/\d{4}/); // contains a 4-digit year
    expect(label.length).toBeGreaterThan(4);
  });

  it('contains the correct year', () => {
    expect(formatMonthLabel('2025-06')).toContain('2025');
  });

  it('differs between consecutive months', () => {
    expect(formatMonthLabel('2024-01')).not.toBe(formatMonthLabel('2024-02'));
  });
});
