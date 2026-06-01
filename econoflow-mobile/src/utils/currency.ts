const SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr',
  BRL: 'R$', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', CNY: '¥',
  INR: '₹', MXN: 'MX$', SGD: 'S$', HKD: 'HK$',
  SEK: 'kr', NOK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei', ZAR: 'R',
};

export function getCurrencySymbol(code: string): string {
  return SYMBOLS[code?.toUpperCase()] ?? code;
}

export const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};
