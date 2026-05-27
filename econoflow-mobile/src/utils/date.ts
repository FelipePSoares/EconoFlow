import dayjs from 'dayjs';

export const toDateOnly = (date: Date | dayjs.Dayjs | string): string =>
  dayjs(date).format('YYYY-MM-DD');

export const fromDateOnly = (input: string): Date => {
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const monthStart = (month: string): string =>
  dayjs(month).startOf('month').format('YYYY-MM-DD');

export const monthEnd = (month: string): string =>
  dayjs(month).add(1, 'month').startOf('month').format('YYYY-MM-DD');

export const formatMonthLabel = (month: string): string =>
  dayjs(month).format('MMMM YYYY');

export const currentMonth = (): string =>
  dayjs().format('YYYY-MM');

export const prevMonth = (month: string): string =>
  dayjs(month).subtract(1, 'month').format('YYYY-MM');

export const nextMonth = (month: string): string =>
  dayjs(month).add(1, 'month').format('YYYY-MM');
