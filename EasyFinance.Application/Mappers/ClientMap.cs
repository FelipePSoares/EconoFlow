using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.Mappers
{
    public static class ClientMap
    {
        public static IEnumerable<ClientResponseDTO> ToDTO(this ICollection<Client> clients) => clients.Select(p => p.ToDTO());
        public static IEnumerable<ClientResponseDTO> ToDTO(this IEnumerable<Client> clients) => clients.Select(p => p.ToDTO());

        public static ClientResponseDTO ToDTO(this Client client)
        {
            ArgumentNullException.ThrowIfNull(client);

            return new ClientResponseDTO()
            {
                Id = client.Id,
                Name = client.Name,
                Email = client.Email,
                Phone = client.Phone,
                Description = client.Description,
                IsActive = client.IsActive,
            };
        }

        public static ClientRequestDTO ToRequestDTO(this Client client)
        {
            ArgumentNullException.ThrowIfNull(client);

            return new ClientRequestDTO()
            {
                Name = client.Name,
                Email = client.Email,
                Phone = client.Phone,
                Description = client.Description
            };
        }

        public static IEnumerable<Client> FromDTO(this ICollection<ClientRequestDTO> clients) => clients.Select(c => c.FromDTO());

        public static Client FromDTO(this ClientRequestDTO clientDTO, Client existingClient = null)
        {
            ArgumentNullException.ThrowIfNull(clientDTO);

            if (existingClient != null)
            {
                existingClient.SetName(clientDTO.Name);
                existingClient.SetEmail(clientDTO.Email);
                existingClient.SetPhone(clientDTO.Phone);
                existingClient.SetDescription(clientDTO.Description);
                return existingClient;
            }

            return new Client(name: clientDTO.Name, email: clientDTO.Email, phone: clientDTO.Phone, description: clientDTO.Description);
        }

    }
}
