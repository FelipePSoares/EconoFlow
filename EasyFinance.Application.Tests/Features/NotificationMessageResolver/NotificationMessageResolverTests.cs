using EasyFinance.Application.Features.NotificationMessageResolver;
using EasyFinance.Common.Tests.AccessControl;
using FluentAssertions;

namespace EasyFinance.Application.Tests.Features
{
    public class NotificationMessageResolverTests
    {
        private readonly INotificationMessageResolver resolver = new NotificationMessageResolver();

        [Fact]
        public void ResolveBody_NoParameters_ShouldReturnResolvedMessage()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("ProjectInvitationPushBodyNoProject")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("You received a project invitation.");
        }

        [Fact]
        public void ResolveBody_WithNamedParameters_ShouldReplacePlaceholders()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("BUDGET_WARNING")
                .AddMetadata("""{"expenseName":"Groceries","projectName":"Monthly"}""")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("Warning: Budget for 'Groceries' in project 'Monthly' is nearly exhausted (80%).");
        }

        [Fact]
        public void ResolveBody_UnknownCodeMessage_ShouldReturnCodeMessage()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("UNKNOWN_CODE_MESSAGE")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("UNKNOWN_CODE_MESSAGE");
        }

        [Fact]
        public void ResolveBody_WithRoleParameter_ShouldLocalizeRole()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("ProjectAccessLevelChangedPushBody")
                .AddMetadata("""{"FullName":"John Doe","Role":"Manager","ProjectName":"My Project"}""")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("John Doe changed your access level to Manager in project My Project.");
        }

        [Fact]
        public void ResolveBody_CaseInsensitiveMetadataKey_ShouldResolve()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("ProjectInvitationPushBodyWithProject")
                .AddMetadata("""{"ProjectName":"My Project"}""")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("You received a project invitation to My Project.");
        }

        [Fact]
        public void ResolveBody_MissingMetadataValue_ShouldKeepPlaceholder()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("BUDGET_WARNING")
                .AddMetadata("""{"expenseName":"Groceries"}""")
                .Build();

            var body = resolver.ResolveBody(notification);

            body.Should().Be("Warning: Budget for 'Groceries' in project '{projectName}' is nearly exhausted (80%).");
        }

        [Fact]
        public void ResolveBody_WithCulture_ShouldReturnLocalizedMessage()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("BUDGET_WARNING")
                .AddMetadata("""{"expenseName":"Compras","projectName":"Mensal"}""")
                .Build();
            notification.User.SetLanguageCode("pt-PT");

            var body = resolver.ResolveBody(notification);

            body.Should().Be("Aviso: O orçamento de 'Compras' no projeto 'Mensal' está quase esgotado (80%).");
        }

        [Fact]
        public void ResolveBody_WithPortugueseRoleParameter_ShouldLocalizeRole()
        {
            var notification = new NotificationBuilder()
                .AddCodeMessage("ProjectAccessLevelChangedPushBody")
                .AddMetadata("""{"FullName":"John Doe","Role":"Manager","ProjectName":"My Project"}""")
                .Build();
            notification.User.SetLanguageCode("pt-PT");

            var body = resolver.ResolveBody(notification);

            body.Should().Be("John Doe alterou seu nível de acceso para Gerente no projeto My Project.");
        }
    }
}
