using System.IO;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// Minimal S3-compatible storage seam. The MinIO implementation is backed by the
    /// Minio SDK; an Amazon S3 implementation (AWSSDK.S3) can replace it by implementing
    /// this same interface without touching the rest of the application.
    /// </summary>
    public interface IMinioS3Client
    {
        Task EnsureBucketExistsAsync(string bucket);
        Task PutObjectAsync(string bucket, string key, Stream stream, long size, string contentType);
        Task<Stream> GetObjectAsync(string bucket, string key);
        Task RemoveObjectAsync(string bucket, string key);
    }
}
