import moment, { Moment } from "moment";

function padTo2Digits(num: number): string {
  return num.toString().padStart(2, '0');
}

function parseDateOnly(input: string): Date | null {
  const match = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(input);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function parseDatePrefix(input: string): Date | null {
  const match = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function isMidnight(input: Date): boolean {
  return input.getHours() === 0
    && input.getMinutes() === 0
    && input.getSeconds() === 0
    && input.getMilliseconds() === 0;
}

function isSameDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
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
    const dateOnly = parseDateOnly(input);
    if (dateOnly) {
      return dateOnly;
    }

    const prefixDate = parseDatePrefix(input);
    const parsedDate = new Date(input);
    if (isNaN(parsedDate.getTime())) {
      return prefixDate ?? parsedDate;
    }

    const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    if (!prefixDate) {
      return localDate;
    }

    if (isMidnight(parsedDate) && !isSameDate(localDate, prefixDate)) {
      return localDate;
    }

    return prefixDate;
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
    const dateOnly = parseDateOnly(input);
    if (dateOnly) {
      return new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), 12);
    }

    const prefixDate = parseDatePrefix(input);
    const parsedDate = new Date(input);
    if (isNaN(parsedDate.getTime())) {
      if (!prefixDate) {
        return parsedDate;
      }

      return new Date(prefixDate.getFullYear(), prefixDate.getMonth(), prefixDate.getDate(), 12);
    }

    const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    if (!prefixDate) {
      return new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12);
    }

    if (isMidnight(parsedDate) && !isSameDate(localDate, prefixDate)) {
      return new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12);
    }

    return new Date(prefixDate.getFullYear(), prefixDate.getMonth(), prefixDate.getDate(), 12);
  }

  const date = new Date(input);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

export function toUtcMomentDate(input: Date | string | Moment): Moment {
  if (moment.isMoment(input)) {
    return input.clone().utc(true).startOf('day');
  }

  if (typeof input === 'string') {
    const parsed = parseDatePrefix(input);
    if (parsed) {
      return moment.utc([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]);
    }

    return moment.utc(input).startOf('day');
  }

  return moment.utc([input.getFullYear(), input.getMonth(), input.getDate()]);
}
