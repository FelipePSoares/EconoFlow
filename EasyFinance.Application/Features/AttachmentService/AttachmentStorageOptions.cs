using System;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class AttachmentStorageOptions
    {
        public const string SectionName = "AttachmentStorage";
        public const string DefaultProvider = "FileSystem";

        public string Provider { get; set; } = DefaultProvider;
        public string LocalRootPath { get; set; } = string.Empty;
        public string Endpoint { get; set; } = string.Empty;
        public string AccessKey { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public bool UseSsl { get; set; } = true;
        public string Region { get; set; } = string.Empty;
    }
}
