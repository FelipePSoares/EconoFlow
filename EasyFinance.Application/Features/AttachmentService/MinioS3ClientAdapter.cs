using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;
using Polly;
using Polly.Retry;

namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// Adapter over the Minio .NET SDK exposing the minimal S3 operations the
    /// application needs. Kept isolated behind <see cref="IMinioS3Client"/> so the
    /// storage backend can be swapped (e.g. AWSSDK.S3) without changing consumers.
    /// </summary>
    public class MinioS3ClientAdapter : IMinioS3Client
    {
        /// <summary>
        /// MinIO can fleetingly return <see cref="AccessDeniedException"/> for a valid
        /// credential on the first request after a period of inactivity (its IAM policy
        /// cache is still warming up). A short bounded retry makes reads resilient to that
        /// transient denial. This is the number of retries AFTER the initial attempt, so a
        /// read is attempted MaxGetRetries + 1 times total before the denial propagates.
        /// </summary>
        private const int MaxGetRetries = 2;

        /// <summary>
        /// MinIO IAM cache warms up almost immediately, so a short constant backoff is enough.
        /// </summary>
        private static readonly TimeSpan GetRetryDelay = TimeSpan.FromMilliseconds(100);

        private readonly IMinioClient client;
        private readonly ILogger<MinioS3ClientAdapter>? logger;
        private readonly ResiliencePipeline getObjectRetryPipeline;

        /// <summary>Carries the bucket name into the retry handler so retry logs are actionable.</summary>
        private static readonly ResiliencePropertyKey<string> BucketContextKey = new("Bucket");

        /// <summary>Carries the object key into the retry handler so retry logs are actionable.</summary>
        private static readonly ResiliencePropertyKey<string> ObjectKeyContextKey = new("ObjectKey");

        public MinioS3ClientAdapter(IMinioClient client)
            : this(client, logger: null)
        {
        }

        public MinioS3ClientAdapter(IMinioClient client, ILogger<MinioS3ClientAdapter>? logger)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
            this.logger = logger;

            this.getObjectRetryPipeline = new ResiliencePipelineBuilder()
                .AddRetry(new RetryStrategyOptions
                {
                    MaxRetryAttempts = MaxGetRetries,
                    Delay = GetRetryDelay,
                    BackoffType = DelayBackoffType.Constant,
                    UseJitter = false,
                    ShouldHandle = new PredicateBuilder().Handle<AccessDeniedException>(),
                    OnRetry = args =>
                    {
                        args.Context.Properties.TryGetValue(BucketContextKey, out var logBucket);
                        args.Context.Properties.TryGetValue(ObjectKeyContextKey, out var logKey);

                        this.logger?.LogWarning(
                            "MinIO returned {AccessDeniedException} for bucket {Bucket} key {ObjectKey} on attempt {AttemptNumber}; retrying in {RetryDelay}.",
                            nameof(AccessDeniedException),
                            logBucket,
                            logKey,
                            args.AttemptNumber + 1,
                            args.RetryDelay);

                        return default;
                    },
                })
                .Build();
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
                var resilienceContext = ResilienceContextPool.Shared.Get();
                try
                {
                    resilienceContext.Properties.Set(BucketContextKey, bucket);
                    resilienceContext.Properties.Set(ObjectKeyContextKey, key);

                    await this.getObjectRetryPipeline.ExecuteAsync(
                        async _ =>
                        {
                            memoryStream.SetLength(0);
                            await this.client.GetObjectAsync(args).ConfigureAwait(false);
                        },
                        resilienceContext).ConfigureAwait(false);
                }
                finally
                {
                    ResilienceContextPool.Shared.Return(resilienceContext);
                }
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
