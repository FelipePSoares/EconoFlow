import { TaxYearLabeling } from "../enums/tax-year-labeling";
import { TaxYearType } from "../enums/tax-year-type";

export class Project {
  id!: string;
  name!: string;
  preferredCurrency!: string;
  taxYearType?: TaxYearType | null;
  taxYearStartMonth?: number | null;
  taxYearStartDay?: number | null;
  taxYearLabeling?: TaxYearLabeling | null;
}
