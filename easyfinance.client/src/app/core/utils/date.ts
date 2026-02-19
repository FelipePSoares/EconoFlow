import moment from "moment";

function padTo2Digits(num: number): string {
  return num.toString().padStart(2, '0');
}

export function formatDateTime(input: Date): string {
  if (moment.isMoment(input))
    input = input.toDate();

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

export function formatDate(input: Date): string {
  if (moment.isMoment(input))
    input = input.toDate();

  return (
    [
      input.getFullYear(),
      padTo2Digits(input.getMonth() + 1),
      padTo2Digits(input.getDate()),
    ].join('-')
  );
};

export function toLocalNoonDate(input: Date | string): Date {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }

  const date = new Date(input);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}
