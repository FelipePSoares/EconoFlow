using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ClientService(IUnitOfWork unitOfWork) : IClientService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;

        public async Task<AppResponse<IEnumerable<ClientResponseDTO>>> GetAllAsync(Guid projectId)
        {
            var result = await unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Clients)
                .Where(p => p.Id == projectId)
                .SelectMany(p => p.Clients)
                .ToListAsync();

            return AppResponse<IEnumerable<ClientResponseDTO>>.Success(result.ToDTO());
        }
        public async Task<AppResponse<ClientResponseDTO>> GetByIdAsync(Guid clientId)
        {
            var result = await unitOfWork.ClientRepository.NoTrackable()
                .FirstOrDefaultAsync(c => c.Id == clientId);

            return AppResponse<ClientResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse<ClientResponseDTO>> CreateAsync(Guid projectId, Client client)
        {
            if (client == default)
                return AppResponse<ClientResponseDTO>.Error(code: nameof(client), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(client)));

            var savedClient = unitOfWork.ClientRepository.InsertOrUpdate(client);
            if (savedClient.Failed)
                return AppResponse<ClientResponseDTO>.Error(savedClient.Messages);

            var project = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Clients)
                .FirstOrDefaultAsync(p => p.Id == projectId);
            
            project.Clients.Add(savedClient.Data);

            var savedProject = unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<ClientResponseDTO>.Error(savedProject.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<ClientResponseDTO>.Success(savedClient.Data.ToDTO());
        }
        public async Task<AppResponse<ClientResponseDTO>> UpdateAsync(Guid clientId, JsonPatchDocument<ClientRequestDTO> clientDto)
        {
            var existingClient = unitOfWork.ClientRepository
                .Trackable()
                .FirstOrDefault(c => c.Id == clientId) ?? throw new KeyNotFoundException(ValidationMessages.ClientNotFound);

            var dto = existingClient.ToRequestDTO();

            clientDto.ApplyTo(dto);

            var result = dto.FromDTO(existingClient);

            return await UpdateAsync(result);
        }

        public async Task<AppResponse<ClientResponseDTO>> UpdateAsync(Client client)
        {
            if (client == default)
                return AppResponse<ClientResponseDTO>.Error(code: nameof(client), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(client)));

            var savedProject = unitOfWork.ClientRepository.InsertOrUpdate(client);
            if (savedProject.Failed)
                return AppResponse<ClientResponseDTO>.Error(savedProject.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<ClientResponseDTO>.Success(client.ToDTO());
        }

        public async Task<AppResponse<ClientResponseDTO>> ActivateAsync(Guid id)
        {
            var client = await unitOfWork.ClientRepository.Trackable()
                .FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException(ValidationMessages.ClientNotFound);

            client.SetActive();

            var savedClient = unitOfWork.ClientRepository.InsertOrUpdate(client);
            if (savedClient.Failed)
                return AppResponse<ClientResponseDTO>.Error(savedClient.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<ClientResponseDTO>.Success(savedClient.Data.ToDTO());
        }
        public async Task<AppResponse> DeactivateAsync(Guid id)
        {
            var client = await unitOfWork.ClientRepository.Trackable()
                .FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException(ValidationMessages.ClientNotFound);

            client.SetDeative();

            var savedClient = unitOfWork.ClientRepository.InsertOrUpdate(client);
            if (savedClient.Failed)
                return AppResponse.Error(savedClient.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }
        public async Task<AppResponse> ArchiveAsync(Guid id)
        {
            var client = await unitOfWork.ClientRepository.Trackable()
                .FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException(ValidationMessages.ClientNotFound);

            client.SetArchived();

            var savedClient = unitOfWork.ClientRepository.InsertOrUpdate(client);
            if (savedClient.Failed)
                return AppResponse.Error(savedClient.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }
    }
}