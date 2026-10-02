import { formatAmount, formatBytes } from '../format';

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

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('rounds kilobytes to one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('handles zero and non-finite values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
