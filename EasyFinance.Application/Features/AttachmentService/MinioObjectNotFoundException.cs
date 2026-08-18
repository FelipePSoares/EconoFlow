using System;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class MinioObjectNotFoundException : Exception
    {
        public MinioObjectNotFoundException()
        {
        }

        public MinioObjectNotFoundException(string message)
            : base(message)
        {
        }

        public MinioObjectNotFoundException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}
