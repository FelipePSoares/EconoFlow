using System.IO;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseAttachmentFileResponseDTO
    {
        public string Name { get; set; } = string.Empty;
        public string ContentType { get; set; } = "application/octet-stream";
        public Stream Content { get; set; } = Stream.Null;
    }
}
