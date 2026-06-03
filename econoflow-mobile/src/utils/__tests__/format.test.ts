import { formatAmount } from '../format';

describe('formatAmount', () => {
  it('uses en locale - period as decimal separator', () => {
    const result = formatAmount(1.5, 'en');
    expect(result).toBe('1.50');
  });

  it('uses pt locale - comma as decimal separator', () => {
    const result = formatAmount(1.5, 'pt');
    expect(result).toBe('1,50');
  });

  it('returns absolute value', () => {
    const pos = formatAmount(42.5, 'en');
    const neg = formatAmount(-42.5, 'en');
    expect(pos).toBe(neg);
  });

  it('formats 2 decimal places', () => {
    expect(formatAmount(10, 'en')).toBe('10.00');
  });
});
