export function formatAmount(n: number, locale?: string): string {
  return Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
