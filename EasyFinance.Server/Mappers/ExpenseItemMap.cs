using EasyFinance.Domain.Models.Financial;
using EasyFinance.Server.DTOs.Financial;

namespace EasyFinance.Server.Mappers
{
    public static class ExpenseItemMap
    {
        public static ICollection<ExpenseItemResponseDTO> ToDTO(this ICollection<ExpenseItem> expenseItems) => expenseItems.Select(p => p.ToDTO()).ToList();

        public static ExpenseItemResponseDTO ToDTO(this ExpenseItem expenseItem)
        {
            ArgumentNullException.ThrowIfNull(expenseItem);

            return new ExpenseItemResponseDTO()
            {
                Id = expenseItem.Id,
                Name = expenseItem.Name,
                Date = expenseItem.Date,
                Amount = expenseItem.Amount,
                Items = expenseItem.Items.ToDTO(),
            };
        }

        public static ICollection<ExpenseItemRequestDTO> ToRequestDTO(this ICollection<ExpenseItem> expenseItems) => expenseItems.Select(p => p.ToRequestDTO()).ToList();

        public static ExpenseItemRequestDTO ToRequestDTO(this ExpenseItem expenseItem)
        {
            ArgumentNullException.ThrowIfNull(expenseItem);

            return new ExpenseItemRequestDTO()
            {
                Name = expenseItem.Name,
                Date = expenseItem.Date,
                Amount = expenseItem.Amount,
                Items = expenseItem.Items.ToRequestDTO(),
            };
        }

        public static ICollection<ExpenseItem> FromDTO(this ICollection<ExpenseItemRequestDTO> expenseItemsDTO, IList<ExpenseItem> expenseItems = null) 
            => expenseItemsDTO.Select((expenseItemDTO, index) => {
                if (index < expenseItems?.Count)
                    return expenseItemDTO.FromDTO(expenseItems[index]);

                return expenseItemDTO.FromDTO();
                }).ToList();

        public static ExpenseItem FromDTO(this ExpenseItemRequestDTO expenseItemDTO, ExpenseItem expenseItem = null)
        {
            ArgumentNullException.ThrowIfNull(expenseItemDTO);

            if (expenseItem != null)
            {
                expenseItem.SetName(expenseItemDTO.Name);
                expenseItem.SetAmount(expenseItemDTO.Amount);
                expenseItem.SetDate(expenseItemDTO.Date);
                expenseItem.SetItems(expenseItemDTO.Items.FromDTO(expenseItem.Items.ToList()));
                return expenseItem;
            }

            return new ExpenseItem(expenseItemDTO.Name, expenseItemDTO.Date, expenseItemDTO.Amount, items: expenseItemDTO.Items.FromDTO());
        }
    }
}
