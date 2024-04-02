
using System;

namespace EasyFinance.Infrastructure.Exceptions
{
    public class ForbiddenException : Exception
    {
        public ForbiddenException(string? message = default) : base(message ?? ValidationMessages.Forbidden)
        {
        }
    }
}
