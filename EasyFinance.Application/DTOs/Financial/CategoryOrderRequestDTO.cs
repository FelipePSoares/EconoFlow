using System;

namespace EasyFinance.Application.DTOs.Financial
{
    public class CategoryOrderRequestDTO
    {
        public Guid CategoryId { get; set; }
        public int DisplayOrder { get; set; }
    }
}
