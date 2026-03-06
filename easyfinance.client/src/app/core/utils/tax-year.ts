import { TaxYearLabeling } from "../enums/tax-year-labeling";
import { TaxYearType } from "../enums/tax-year-type";
import { ProjectTaxYearSettings } from "../models/project-tax-year-settings";
import { toLocalDate } from "./date";

export interface ComputedTaxYearPeriod {
  taxYearId: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

export function hasTaxYearRuleConfigured(settings: ProjectTaxYearSettings | null | undefined): boolean {
  return !!settings?.taxYearType;
}

export function computeTaxYearPeriod(settings: ProjectTaxYearSettings | null | undefined, inputDate: Date | string): ComputedTaxYearPeriod | null {
  if (!settings?.taxYearType) {
    return null;
  }

  const date = toLocalDate(inputDate);
  if (isNaN(date.getTime())) {
    return null;
  }

  if (settings.taxYearType === TaxYearType.CalendarYear) {
    const year = date.getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const yearLabel = year.toString();

    return {
      taxYearId: yearLabel,
      label: yearLabel,
      startDate,
      endDate
    };
  }

  const startMonth = settings.taxYearStartMonth;
  if (!startMonth || startMonth < 1 || startMonth > 12) {
    return null;
  }

  const configuredStartDay = settings.taxYearStartDay ?? 1;
  const thisYearStartDate = buildCustomStartDate(date.getFullYear(), startMonth, configuredStartDay);
  const startYear = date >= thisYearStartDate ? date.getFullYear() : date.getFullYear() - 1;
  const startDate = buildCustomStartDate(startYear, startMonth, configuredStartDay);
  const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate() - 1);
  const taxYearId = `${startDate.getFullYear().toString().padStart(4, '0')}-${startMonth.toString().padStart(2, '0')}`;
  const labeling = settings.taxYearLabeling ?? TaxYearLabeling.ByStartYear;
  const labelYear = labeling === TaxYearLabeling.ByEndYear ? endDate.getFullYear() : startDate.getFullYear();

  return {
    taxYearId,
    label: labelYear.toString(),
    startDate,
    endDate
  };
}

function buildCustomStartDate(year: number, month: number, day: number): Date {
  const boundedDay = Math.max(1, Math.min(day, new Date(year, month, 0).getDate()));
  return new Date(year, month - 1, boundedDay);
}
