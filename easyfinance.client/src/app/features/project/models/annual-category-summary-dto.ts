export interface AnnualCategorySummary {
  name: string;
  amount: number;
}

interface AnnualCategorySummaryApi {
  Name?: string;
  Amount?: number;
  name?: string;
  amount?: number;
}

export class AnnualCategorySummaryDto {
  static fromApi(response: AnnualCategorySummaryApi): AnnualCategorySummary {
    return {
      name: response.name ?? response.Name ?? '',
      amount: response.amount ?? response.Amount ?? 0
    };
  }

  static fromApiList(response: AnnualCategorySummaryApi[]): AnnualCategorySummary[] {
    return response
      .map(item => AnnualCategorySummaryDto.fromApi(item))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }
}
