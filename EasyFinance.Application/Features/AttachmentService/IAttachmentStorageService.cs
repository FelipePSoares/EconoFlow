using System.IO;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.AttachmentService
{
    public interface IAttachmentStorageService
    {
        Task<string> SaveAsync(Stream content, string fileName);
        Task<Stream> OpenReadAsync(string storageKey);
        Task DeleteAsync(string storageKey);
    }
}
