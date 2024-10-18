using EasyFinance.Domain.Models.Financial;
using System.Collections.Generic;

namespace EasyFinance.Domain.Financial
{
    public class DefaultCategory
    {
        private DefaultCategory(string name)
        {
            Name = name;
        }

        // Property to hold the name of the category
        public string Name { get; private set; }

        // Static instances of predefined categories
        public static readonly DefaultCategory FixedExpenses = new DefaultCategory("Fixed Expenses");
        public static readonly DefaultCategory Comfort = new DefaultCategory("Comfort");
        public static readonly DefaultCategory Pleasures = new DefaultCategory("Your Future");
        public static readonly DefaultCategory YourFuture = new DefaultCategory("Food");
        public static readonly DefaultCategory SelfImprovement = new DefaultCategory("Self-Improvement");
        public static readonly DefaultCategory CustosFixos = new DefaultCategory("Custos Fixos");

        // Optional: Method to get all the defined categories
        public static IEnumerable<DefaultCategory> GetAll()
        {
            return new[] { FixedExpenses, Comfort, Pleasures, YourFuture, SelfImprovement };
        }

        // Override ToString() to easily print the category name
        public override string ToString()
        {
            return Name;
        }

        // Equality override to compare instances by name
        public override bool Equals(object obj)
        {
            if (obj is Category category)
            {
                return Name == category.Name;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return Name.GetHashCode();
        }
    }
}
