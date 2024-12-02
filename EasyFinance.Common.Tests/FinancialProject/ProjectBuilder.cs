using System;
using System.Collections.Generic;
using AutoFixture;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Common.Tests.FinancialProject
{
    public class ProjectBuilder : IBuilder<Project>
    {
        private Project project;

        public ProjectBuilder()
        {
            var fixture = new Fixture();

            this.project = new Project();
            this.AddName(fixture.Create<string>());
            this.AddType(ProjectType.Personal);
        }

        public ProjectBuilder AddName(string name)
        {
            this.project.SetName(name);
            return this;
        }

        public ProjectBuilder AddType(ProjectType type) 
        {
            this.project.SetType(type);
            return this;
        }

        public ProjectBuilder AddCategories(ICollection<Category> categories)
        {
            this.project.SetCategories(categories);
            return this;
        }
        public ProjectBuilder AddCategory(Category category)
        {
            this.project.AddCategory(category);
            return this;
        }

        public ProjectBuilder AddIncomes(ICollection<Income> incomes)
        {
            this.project.SetIncomes(incomes);
            return this;
        }

        public ProjectBuilder AddIncome(Income income)
        {
            this.project.AddIncome(income);
            return this;
        }

        public Project Build() => this.project;

    }
}
