using System;

namespace EasyFinance.Infrastructure.Validators
{
    public class TimeZoneValidator
    {
        public static bool TryGetTimeZoneInfo(string timeZoneId, out TimeZoneInfo timeZoneInfo)
        {
            try
            {
                timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
                return true;
            }
            catch (TimeZoneNotFoundException)
            {
                timeZoneInfo = TimeZoneInfo.Utc;
                return false;
            }
            catch (InvalidTimeZoneException)
            {
                timeZoneInfo = TimeZoneInfo.Utc;
                return false;
            }
        }
    }
}