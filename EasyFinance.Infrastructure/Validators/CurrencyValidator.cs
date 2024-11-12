using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace EasyFinance.Infrastructure.Validators
{
    public class CurrencyValidator
    {
        private static readonly HashSet<string> Iso4217CurrencyCodes = new HashSet<string>(
            CultureInfo.GetCultures(CultureTypes.SpecificCultures)
            .Select(c => new RegionInfo(c.Name).ISOCurrencySymbol)
            .Distinct()
        );

        public static bool IsValidCurrencyCode(string currencyCode)
        {
            return Iso4217CurrencyCodes.Contains(currencyCode.ToUpperInvariant());
        }
    }
}