using System.Threading;
using System.Threading.Tasks;

namespace EasyFinance.Application.BackgroundServices.AttachmentCleanup
{
    public interface ITemporaryAttachmentCleanupService
    {
        Task<int> CleanupOnceAsync(CancellationToken cancellationToken = default);
    }
}
