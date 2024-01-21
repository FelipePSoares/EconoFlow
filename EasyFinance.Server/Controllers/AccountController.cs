using EasyFinance.Server.DTOs;
using EasyFinance.Server.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;

namespace EasyFinance.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        //temporary to emulate database registry
        List<AppUser> _users = new List<AppUser>();

        [HttpPost("register")]
        public async Task<ActionResult<AppUser>> Register(RegisterDto registerDto)
        {
            if(!registerDto._isEmailConfirmed)
            {
                return BadRequest("The emails must match");
            }

            if (await UserExists(registerDto.Email))
            {
                return BadRequest("The user already exists");
            }

            using var hmac = new HMACSHA3_512();

            var user = new AppUser
            {
                Email = registerDto.Email.ToLower(),
                PasswordHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(registerDto.Password)),
                PasswordSalt = hmac.Key
            };

            _users.Add(user);

            return user;
        }


        [HttpPost("login")]
        public async Task<ActionResult<AppUser>> Login(LoginDto loginDto)
        {
            var user = _users.SingleOrDefault(u => u.Email == loginDto.Email.ToLower());

            if(user == null)
            {
                return Unauthorized();
            }

            if(!await PasswordMatch(user, loginDto.Password))
            {
                return Unauthorized("The password is invalid");
            }

            return Ok(user);
        }

        private async Task<bool> PasswordMatch(AppUser user, string password)
        {
            using var hmac = new HMACSHA3_512(user.PasswordSalt);

            var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));

            for(int i = 0; i < computedHash.Length; i++)
            {
                if (computedHash[i] != user.PasswordHash[i])
                {
                    return false;
                }
            }
            return true;
        }

        private async Task<bool> UserExists(string email)
        {
            return _users.Any(u => u.Email == email.ToLower());
        }
    }
}
