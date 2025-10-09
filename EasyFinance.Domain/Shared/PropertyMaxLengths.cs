using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using System.Collections.Generic;

namespace EasyFinance.Domain.Shared
{
    public static class PropertyMaxLengths
    {
        private static readonly Dictionary<PropertyType, int> _maxLengths = new()
        {
            [PropertyType.UserFirstName] = 256,
            [PropertyType.UserLastName] = 256,
            [PropertyType.UserEmail] = 256,
            [PropertyType.UserProjectEmail] = 256,
            [PropertyType.AttachmentName] = 150,
            [PropertyType.CategoryName] = 150,
            [PropertyType.ExpenseName] = 150,
            [PropertyType.ExpenseItemName] = 150,
            [PropertyType.IncomeName] = 150,
            [PropertyType.ProjectName] = 150
        };

        public static int GetMaxLength(PropertyType propertytype)
            => _maxLengths[propertytype];
    }
}
