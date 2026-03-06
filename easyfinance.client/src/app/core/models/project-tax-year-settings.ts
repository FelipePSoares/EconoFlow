import { TaxYearLabeling } from "../enums/tax-year-labeling";
import { TaxYearType } from "../enums/tax-year-type";

export interface ProjectTaxYearSettings {
  taxYearType: TaxYearType | null;
  taxYearStartMonth: number | null;
  taxYearStartDay: number | null;
  taxYearLabeling: TaxYearLabeling | null;
}

export interface ProjectTaxYearSettingsRequest {
  taxYearType: TaxYearType;
  taxYearStartMonth?: number | null;
  taxYearStartDay?: number | null;
  taxYearLabeling?: TaxYearLabeling | null;
}

export function getDefaultProjectTaxYearSettings(): ProjectTaxYearSettings {
  return {
    taxYearType: null,
    taxYearStartMonth: null,
    taxYearStartDay: null,
    taxYearLabeling: null
  };
}

export function isTaxYearConfigured(settings: ProjectTaxYearSettings | null | undefined): boolean {
  return !!settings?.taxYearType;
}
