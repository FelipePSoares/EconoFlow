using EasyFinance.Application.Features.EmailService;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Tests.Features.EmailService
{
    public class MailKitSmtpClientFactoryTests
    {
        [Theory]
        [InlineData(0)]
        [InlineData(30)]
        public void Create_ShouldReturnAMailKitSmtpClient(int timeoutSeconds)
        {
            var factory = new MailKitSmtpClientFactory(Options.Create(new SmtpSettings { TimeoutSeconds = timeoutSeconds }));

            using var client = factory.Create();

            client.Should().BeOfType<MailKitSmtpClient>();
        }
    }
}
