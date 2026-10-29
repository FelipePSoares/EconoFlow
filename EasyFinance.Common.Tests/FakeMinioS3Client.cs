using System.Collections.Concurrent;
using System.IO;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;

namespace EasyFinance.Common.Tests
{
    /// <summary>
    /// An <see cref="IMinioS3Client"/> that keeps objects in a dictionary.
    ///
    /// <para>
    /// Object storage is the only attachment backend, so the attachment tests need a client
    /// without a MinIO server, a network, or a temporary directory. Objects are copied into
    /// memory on write and out on read, so a test can assert on the bytes an upload stored
    /// exactly as it would against a real bucket - and a read of a missing key throws
    /// <see cref="MinioObjectNotFoundException"/>, which is what the adapter translates a
    /// missing object into.
    /// </para>
    /// </summary>
    public sealed class FakeMinioS3Client : IMinioS3Client
    {
        private readonly ConcurrentDictionary<string, byte[]> objects = new();

        public Task EnsureBucketExistsAsync(string bucket) => Task.CompletedTask;

        public async Task PutObjectAsync(string bucket, string key, Stream stream, long size, string contentType)
        {
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer);
            this.objects[Compose(bucket, key)] = buffer.ToArray();
        }

        public Task<Stream> GetObjectAsync(string bucket, string key)
        {
            if (!this.objects.TryGetValue(Compose(bucket, key), out var payload))
                throw new MinioObjectNotFoundException(key);

            return Task.FromResult<Stream>(new MemoryStream(payload, writable: false));
        }

        public Task RemoveObjectAsync(string bucket, string key)
        {
            this.objects.TryRemove(Compose(bucket, key), out _);
            return Task.CompletedTask;
        }

        /// <summary>
        /// The stored bytes for a key, or <c>null</c> when nothing was written there.
        /// </summary>
        public byte[]? Read(string bucket, string key) =>
            this.objects.TryGetValue(Compose(bucket, key), out var payload) ? payload : null;

        public bool Exists(string bucket, string key) => this.objects.ContainsKey(Compose(bucket, key));

        private static string Compose(string bucket, string key) => $"{bucket}/{key}";
    }
}
