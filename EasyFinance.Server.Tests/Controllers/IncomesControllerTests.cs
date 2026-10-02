using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Server.Controllers;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.Controllers
{
    public class IncomesControllerTests
    {
        private readonly Mock<IIncomeService> incomeService = new();
        private readonly Mock<IAttachmentService> attachmentService = new();
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly IncomesController controller;
        private readonly User user;
        private readonly Guid projectId = Guid.NewGuid();
        private readonly Guid incomeId = Guid.NewGuid();
        private readonly Guid attachmentId = Guid.NewGuid();

        public IncomesControllerTests()
        {
            this.user = new UserBuilder().AddEmail("incomes@econoflow.test").Build();
#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            this.userManagerMock = new Mock<UserManager<User>>(
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

            this.userManagerMock
                .Setup(manager => manager.FindByIdAsync(It.IsAny<string>()))
                .ReturnsAsync(this.user);

            this.controller = new IncomesController(this.incomeService.Object, this.attachmentService.Object, this.userManagerMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>
                        {
                            new(ClaimTypes.NameIdentifier, this.user.Id.ToString())
                        }))
                    }
                }
            };
        }

        private static IFormFile BuildFile(byte[] payload, string fileName = "payslip.pdf", string contentType = "application/pdf")
        {
            var stream = new MemoryStream(payload);
            return new FormFile(stream, 0, payload.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private static AttachmentResponseDTO BuildAttachmentResponse() => new()
        {
            Name = "payslip.pdf",
            ContentType = "application/pdf",
            Size = 4,
            AttachmentType = AttachmentType.General,
            IsTemporary = false
        };

        [Fact]
        public async Task UploadTemporaryAttachmentAsync_WithValidFile_ShouldReturnCreated()
        {
            // Arrange
            this.attachmentService
                .Setup(service => service.UploadTemporaryAttachmentAsync(
                    It.IsAny<User>(),
                    It.IsAny<Guid>(),
                    It.IsAny<Stream>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<long>(),
                    It.IsAny<AttachmentType>()))
                .ReturnsAsync(AppResponse<AttachmentResponseDTO>.Success(BuildAttachmentResponse()));

            // Act
            var result = await this.controller.UploadTemporaryAttachmentAsync(this.projectId, BuildFile(new byte[] { 1, 2, 3, 4 }));

            // Assert
            var objectResult = result.ShouldBeOfType<ObjectResult>();
            objectResult.StatusCode.ShouldBe(StatusCodes.Status201Created);
        }

        [Fact]
        public async Task UploadAttachmentAsync_WithValidFile_ShouldReturnCreated()
        {
            // Arrange
            this.attachmentService
                .Setup(service => service.UploadIncomeAttachmentAsync(
                    It.IsAny<User>(),
                    It.IsAny<Guid>(),
                    It.IsAny<Guid>(),
                    It.IsAny<Stream>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<long>()))
                .ReturnsAsync(AppResponse<AttachmentResponseDTO>.Success(BuildAttachmentResponse()));

            // Act
            var result = await this.controller.UploadAttachmentAsync(this.projectId, this.incomeId, BuildFile(new byte[] { 1, 2, 3, 4 }));

            // Assert
            var objectResult = result.ShouldBeOfType<ObjectResult>();
            objectResult.StatusCode.ShouldBe(StatusCodes.Status201Created);
        }

        [Fact]
        public async Task UploadAttachmentAsync_WithNullFile_ShouldReturnBadRequest()
        {
            // Act
            var result = await this.controller.UploadAttachmentAsync(this.projectId, this.incomeId, null);

            // Assert
            result.ShouldBeOfType<BadRequestResult>();
            this.attachmentService.Verify(
                service => service.UploadIncomeAttachmentAsync(
                    It.IsAny<User>(),
                    It.IsAny<Guid>(),
                    It.IsAny<Guid>(),
                    It.IsAny<Stream>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<long>()),
                Times.Never);
        }

        [Fact]
        public async Task UploadAttachmentAsync_WithEmptyFile_ShouldReturnBadRequest()
        {
            // Act
            var result = await this.controller.UploadAttachmentAsync(this.projectId, this.incomeId, BuildFile(Array.Empty<byte>()));

            // Assert
            result.ShouldBeOfType<BadRequestResult>();
        }

        [Fact]
        public async Task GetAttachmentAsync_ShouldReturnFileContent()
        {
            // Arrange
            var payload = new byte[] { 9, 8, 7 };

            this.attachmentService
                .Setup(service => service.GetIncomeAttachmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()))
                .ReturnsAsync(AppResponse<AttachmentFileResponseDTO>.Success(new AttachmentFileResponseDTO
                {
                    Name = "payslip.pdf",
                    ContentType = "application/pdf",
                    Content = new MemoryStream(payload)
                }));

            // Act
            var result = await this.controller.GetAttachmentAsync(this.projectId, this.incomeId, this.attachmentId);

            // Assert
            var fileResult = result.ShouldBeOfType<FileStreamResult>();
            fileResult.ContentType.ShouldBe("application/pdf");
            fileResult.FileDownloadName.ShouldBe("payslip.pdf");

            using var buffer = new MemoryStream();
            await fileResult.FileStream.CopyToAsync(buffer);
            buffer.ToArray().ShouldBe(payload);
        }

        [Fact]
        public async Task DeleteAttachmentAsync_ShouldReturnOk()
        {
            // Arrange
            this.attachmentService
                .Setup(service => service.DeleteIncomeAttachmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()))
                .ReturnsAsync(AppResponse.Success());

            // Act
            var result = await this.controller.DeleteAttachmentAsync(this.projectId, this.incomeId, this.attachmentId);

            // Assert
            var statusCodeResult = result.ShouldBeOfType<StatusCodeResult>();
            statusCodeResult.StatusCode.ShouldBe(StatusCodes.Status200OK);
        }
    }
}
