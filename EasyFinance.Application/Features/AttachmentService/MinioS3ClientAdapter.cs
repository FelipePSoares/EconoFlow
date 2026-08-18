using System;
using System.IO;
using System.Threading.Tasks;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// Adapter over the Minio .NET SDK exposing the minimal S3 operations the
    /// application needs. Kept isolated behind <see cref="IMinioS3Client"/> so the
    /// storage backend can be swapped (e.g. AWSSDK.S3) without changing consumers.
    /// </summary>
    public class MinioS3ClientAdapter : IMinioS3Client
    {
        private readonly IMinioClient client;

        public MinioS3ClientAdapter(IMinioClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public async Task EnsureBucketExistsAsync(string bucket)
        {
            var args = new BucketExistsArgs().WithBucket(bucket);
            var exists = await this.client.BucketExistsAsync(args).ConfigureAwait(false);

            if (!exists)
            {
                var makeArgs = new MakeBucketArgs().WithBucket(bucket);
                await this.client.MakeBucketAsync(makeArgs).ConfigureAwait(false);
            }
        }

        public async Task PutObjectAsync(string bucket, string key, Stream stream, long size, string contentType)
        {
            var args = new PutObjectArgs()
                .WithBucket(bucket)
                .WithObject(key)
                .WithStreamData(stream)
                .WithObjectSize(size)
                .WithContentType(contentType);

            await this.client.PutObjectAsync(args).ConfigureAwait(false);
        }

        public async Task<Stream> GetObjectAsync(string bucket, string key)
        {
            var memoryStream = new MemoryStream();
            var args = new GetObjectArgs()
                .WithBucket(bucket)
                .WithObject(key)
                .WithCallbackStream(async (stream, cancellationToken) =>
                {
                    await stream.CopyToAsync(memoryStream, cancellationToken).ConfigureAwait(false);
                });

            try
            {
                await this.client.GetObjectAsync(args).ConfigureAwait(false);
            }
            catch (ObjectNotFoundException)
            {
                throw new MinioObjectNotFoundException(key);
            }

            memoryStream.Position = 0;
            return memoryStream;
        }

        public async Task RemoveObjectAsync(string bucket, string key)
        {
            var args = new RemoveObjectArgs().WithBucket(bucket).WithObject(key);
            await this.client.RemoveObjectAsync(args).ConfigureAwait(false);
        }
    }
}
