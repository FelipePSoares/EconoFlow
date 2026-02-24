import moment, { Moment } from "moment";

function padTo2Digits(num: number): string {
  return num.toString().padStart(2, '0');
}

function parseDatePrefix(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatDateTime(input: Date | Moment): string {
  if (moment.isMoment(input)) {
    return (
      [
        input.year(),
        padTo2Digits(input.month() + 1),
        padTo2Digits(input.date()),
      ].join('-') +
      ' ' +
      [
        padTo2Digits(input.hour()),
        padTo2Digits(input.minute()),
        padTo2Digits(input.second()),
      ].join(':')
    );
  }

  return (
    [
      input.getFullYear(),
      padTo2Digits(input.getMonth() + 1),
      padTo2Digits(input.getDate()),
    ].join('-') +
    ' ' +
    [
      padTo2Digits(input.getHours()),
      padTo2Digits(input.getMinutes()),
      padTo2Digits(input.getSeconds()),
    ].join(':')
  );
};

export function formatDate(input: Date | Moment): string {
  if (moment.isMoment(input)) {
    return (
      [
        input.year(),
        padTo2Digits(input.month() + 1),
        padTo2Digits(input.date()),
      ].join('-')
    );
  }

  return (
    [
      input.getFullYear(),
      padTo2Digits(input.getMonth() + 1),
      padTo2Digits(input.getDate()),
    ].join('-')
  );
};

export function toLocalDate(input: Date | string | Moment): Date {
  if (moment.isMoment(input)) {
    return new Date(input.year(), input.month(), input.date());
  }

  if (typeof input === 'string') {
    const parsed = parseDatePrefix(input);
    if (parsed) {
      return parsed;
    }
  }

  const date = new Date(input);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateOnlyString(input: Date | string | Moment | undefined | null): string {
  if (!input) {
    return '';
  }

  const normalized = toLocalDate(input);
  if (isNaN(normalized.getTime())) {
    return typeof input === 'string' ? input : '';
  }

  return formatDate(normalized);
}

export function toLocalNoonDate(input: Date | string | Moment): Date {
  if (moment.isMoment(input)) {
    return new Date(input.year(), input.month(), input.date(), 12);
  }

  if (typeof input === 'string') {
    const parsed = parseDatePrefix(input);
    if (parsed) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
    }
  }

  const date = new Date(input);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}
