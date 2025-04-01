function padTo2Digits(num: number): string {
  return num.toString().padStart(2, '0');
}

export function formatDate(input: Date): string {
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

export function todayUTC(): Date {
  const newDate = new Date();
  return dateUTC(newDate);
}

export function dateUTC(newDate: Date): Date;
export function dateUTC(year: number, month: number, day?: number): Date;
export function dateUTC(dateOrYear: Date | number, month?: number, day?: number): Date {
  if (typeof dateOrYear === 'number') {
    return new Date(Date.UTC(dateOrYear, month, day ?? 1));
  }

  dateOrYear = new Date(dateOrYear);

  if (dateOrYear instanceof Date) {
    return new Date(Date.UTC(dateOrYear.getFullYear(), dateOrYear.getMonth(), dateOrYear.getDate()));
  }

  return todayUTC();
}
