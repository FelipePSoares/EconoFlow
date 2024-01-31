using EasyFinance.Domain.Models.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Server.Context
{
    class AppDbContext(DbContextOptions<AppDbContext> options) :
        IdentityDbContext<User, IdentityRole<Guid>, Guid>(options)
    {
    }
}
