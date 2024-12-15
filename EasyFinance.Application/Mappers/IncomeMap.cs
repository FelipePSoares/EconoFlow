using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Financial;
using EasyFinance.Application.DTOs.Financial;
using System.Collections.Generic;
using System;
using System.Linq;

namespace EasyFinance.Application.Mappers
{
    public static class IncomeMap
    {
        public static IEnumerable<IncomeResponseDTO> ToDTO(this ICollection<Income> incomes) => incomes.Select(p => p.ToDTO());
        public static IEnumerable<IncomeResponseDTO> ToDTO(this IEnumerable<Income> incomes) => incomes.Select(p => p.ToDTO());

        public static IncomeResponseDTO ToDTO(this Income income)
        {
            ArgumentNullException.ThrowIfNull(income);

            return new IncomeResponseDTO()
            {
                Id = income.Id,
                Name = income.Name,
                Amount = income.Amount,
                Date = income.Date
            };
        }

        public static IncomeRequestDTO ToRequestDTO(this Income income)
        {
            ArgumentNullException.ThrowIfNull(income);

            return new IncomeRequestDTO()
            {
                Name = income.Name,
                Amount = income.Amount,
                Date = income.Date
            };
        }

        public static IEnumerable<Income> FromDTO(this ICollection<IncomeRequestDTO> incomes) => incomes.Select(p => p.FromDTO());

        public static Income FromDTO(this IncomeRequestDTO incomeDTO, Income income = null)
        {
            ArgumentNullException.ThrowIfNull(incomeDTO);

            if (income != null)
            {
                income.SetName(incomeDTO.Name);
                income.SetAmount(incomeDTO.Amount);
                income.SetDate(incomeDTO.Date);
            }

            return new Income(name: incomeDTO.Name, amount: incomeDTO.Amount, date: incomeDTO.Date);
        }
    }
}
