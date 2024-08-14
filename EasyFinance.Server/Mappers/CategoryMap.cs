using EasyFinance.Domain.Models.Financial;
using EasyFinance.Server.DTOs.Financial;

namespace EasyFinance.Server.Mappers
{
    public static class CategoryMap
    {
        public static IEnumerable<CategoryResponseDTO> ToDTO(this ICollection<Category> categories) 
            => categories.Select(p => p.ToDTO());

        public static CategoryResponseDTO ToDTO(this Category category)
        {
            ArgumentNullException.ThrowIfNull(category);

            return new CategoryResponseDTO()
            {
                Id = category.Id,
                Name = category.Name,
                Goal = category.Goal,
                Expenses = category.Expenses
            };
        }

        public static CategoryRequestDTO ToRequestDTO(this Category category)
        {
            ArgumentNullException.ThrowIfNull(category);

            return new CategoryRequestDTO()
            {
                Name = category.Name,
                Goal = category.Goal
            };
        }

        public static IEnumerable<Category> FromDTO(this ICollection<CategoryRequestDTO> categories) => categories.Select(p => p.FromDTO());

        public static Category FromDTO(this CategoryRequestDTO categoryDTO, Category category = null)
        {
            ArgumentNullException.ThrowIfNull(categoryDTO);

            if (category != null)
            {
                category.SetName(categoryDTO.Name);
                category.SetGoal(categoryDTO.Goal);
            }

            return new Category(name: categoryDTO.Name, goal: categoryDTO.Goal);
        }
    }
}
