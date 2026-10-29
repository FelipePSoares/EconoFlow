using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Server.Controllers;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.Controllers
{
    /// <summary>
    /// The download actions replay an uploaded file to a browser, so they must keep handing it
    /// over as a named attachment and forbid the browser from re-interpreting the type.
    /// </summary>
    public class AttachmentDownloadTests
    {
        private readonly Mock<IAttachmentService> attachmentService = new();
        private readonly User user = new UserBuilder().AddEmail("downloads@econoflow.test").Build();
        private readonly Guid projectId = Guid.NewGuid();
        private readonly Guid categoryId = Guid.NewGuid();
        private readonly Guid expenseId = Guid.NewGuid();
        private readonly Guid expenseItemId = Guid.NewGuid();
        private readonly Guid attachmentId = Guid.NewGuid();

        [Fact]
        public async Task ExpensesController_GetAttachmentAsync_ShouldSetNoSniffHeader()
        {
            this.attachmentService
                .Setup(service => service.GetExpenseAttachmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()))
                .ReturnsAsync(AppResponse<AttachmentFileResponseDTO>.Success(FileResponse()));

            var controller = new ExpensesController(
                new Mock<IExpenseService>().Object,
                this.attachmentService.Object,
                BuildUserManager().Object)
            {
                ControllerContext = BuildControllerContext()
            };

            var result = await controller.GetAttachmentAsync(this.projectId, this.categoryId, this.expenseId, this.attachmentId);

            AssertDownload(result, controller.Response);
        }

        [Fact]
        public async Task ExpenseItemsController_GetAttachmentAsync_ShouldSetNoSniffHeader()
        {
            this.attachmentService
                .Setup(service => service.GetExpenseItemAttachmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()))
                .ReturnsAsync(AppResponse<AttachmentFileResponseDTO>.Success(FileResponse()));

            var controller = new ExpenseItemsController(
                new Mock<IExpenseItemService>().Object,
                this.attachmentService.Object,
                BuildUserManager().Object)
            {
                ControllerContext = BuildControllerContext()
            };

            var result = await controller.GetAttachmentAsync(
                this.projectId,
                this.categoryId,
                this.expenseId,
                this.expenseItemId,
                this.attachmentId);

            AssertDownload(result, controller.Response);
        }

        private static AttachmentFileResponseDTO FileResponse() => new()
        {
            Name = "receipt.png",
            ContentType = "image/png",
            Content = new MemoryStream(new byte[] { 1, 2, 3 })
        };

        private static void AssertDownload(IActionResult result, HttpResponse response)
        {
            var fileResult = result.ShouldBeOfType<FileStreamResult>();
            fileResult.ContentType.ShouldBe("image/png");
            fileResult.FileDownloadName.ShouldBe("receipt.png");
            response.Headers["X-Content-Type-Options"].ToString().ShouldBe("nosniff");
        }

        private Mock<UserManager<User>> BuildUserManager()
        {
#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            var userManager = new Mock<UserManager<User>>(
                new Mock<IUserStore<User>>().Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            userManager
                .Setup(manager => manager.FindByIdAsync(It.IsAny<string>()))
                .ReturnsAsync(this.user);

            return userManager;
        }

        private ControllerContext BuildControllerContext() => new()
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, this.user.Id.ToString())
                }))
            }
        };
    }
}
