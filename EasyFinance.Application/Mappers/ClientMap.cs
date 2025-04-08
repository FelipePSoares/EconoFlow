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
    }
}
