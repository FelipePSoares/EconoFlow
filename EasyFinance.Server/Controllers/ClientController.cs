using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Mappers;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Company/[controller]")]
    public class ClientController(IClientService clientService) : BaseController
    {
        private readonly IClientService clientService = clientService;

        [HttpGet]
        public async Task<IActionResult> GetAll(Guid projectId)
        {
            var result = await clientService.GetAllAsync(projectId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpGet("{clientId}")]
        public async Task<IActionResult> GetById(Guid clientId)
        {
            var result = await clientService.GetByIdAsync(clientId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] ClientRequestDTO clientRequestDTO)
        {
            if (clientRequestDTO == null) return BadRequest();

            var result = await clientService.CreateAsync(projectId, clientRequestDTO.FromDTO());

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, clientId = result.Data.Id }, appResponse: result);
        }

        [HttpPatch("{clientId}")]
        public async Task<IActionResult> Update(Guid clientId, [FromBody] JsonPatchDocument<ClientRequestDTO> clientDTO)
        {
            if (clientDTO == null) return BadRequest();

            var result = await clientService.UpdateAsync(clientId, clientDTO);
            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpPut("{clientId}/deactivate")]
        public async Task<IActionResult> DeactivateAsync(Guid clientId)
        {
            var result = await clientService.DeactivateAsync(clientId);

            return ValidateResponse(result, HttpStatusCode.NoContent);
        }

        [HttpPut("{clientId}/activate")]
        public async Task<IActionResult> ActivateAsync(Guid clientId)
        {
            var result = await clientService.ActivateAsync(clientId);

            return ValidateResponse(result, HttpStatusCode.NoContent);
        }

        [HttpPut("{clientId}/archive")]
        public async Task<IActionResult> ArchiveAsync(Guid clientId)
        {
            var result = await clientService.ArchiveAsync(clientId);

            return ValidateResponse(result, HttpStatusCode.NoContent);
        }
    }
}
