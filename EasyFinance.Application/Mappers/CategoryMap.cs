using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Application.Mappers
{
    public static class CategoryMap
    {
        public static IEnumerable<CategoryResponseDTO> ToDTO(this ICollection<Category> categories) => categories.Select(p => p.ToDTO());
        public static IEnumerable<CategoryResponseDTO> ToDTO(this IEnumerable<Category> categories) => categories.Select(p => p.ToDTO());

        public static CategoryResponseDTO ToDTO(this Category category)
        {
            ArgumentNullException.ThrowIfNull(category);

            return new CategoryResponseDTO()
            {
                Id = category.Id,
                Name = category.Name,
                Expenses = category.Expenses
            };
        }

        public static CategoryRequestDTO ToRequestDTO(this Category category)
        {
            ArgumentNullException.ThrowIfNull(category);

            return new CategoryRequestDTO()
            {
                Name = category.Name
            };
        }

        public static IEnumerable<Category> FromDTO(this ICollection<CategoryRequestDTO> categories) => categories.Select(p => p.FromDTO());

        public static Category FromDTO(this CategoryRequestDTO categoryDTO, Category category = null)
        {
            ArgumentNullException.ThrowIfNull(categoryDTO);

            if (category != null)
            {
                category.SetName(categoryDTO.Name);
                return category;
            }

            return new Category(name: categoryDTO.Name);
        }
    }
}
