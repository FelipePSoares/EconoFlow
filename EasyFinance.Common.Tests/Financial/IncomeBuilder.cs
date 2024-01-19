using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class IncomeBuilder : BaseFinancialBuilder<Income>
    {
        public IncomeBuilder() : base(new Income())
        {
        }
    }
}
