using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EQDashboard.Data;
using EQDashboard.Models;
using EQDashboard.DTOs;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace EQDashboard.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/accounts
        // 實作分頁機制，避免一次載入上萬筆資料
        [HttpGet]
        public async Task<ActionResult<PagedResult<AccountDto>>> GetAccounts(
            [FromQuery] int page = 1, 
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null)
        {
            var query = _context.Accounts.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(a => a.EmpId.Contains(search) || (a.Name != null && a.Name.Contains(search)));
            }

            int totalCount = await query.CountAsync();
            int totalPages = (int)System.Math.Ceiling(totalCount / (double)pageSize);

            var accounts = await query
                .OrderBy(a => a.EmpId)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AccountDto
                {
                    Id = 0, // 舊 API 相容
                    EmpId = a.EmpId,
                    Name = a.Name,
                    Email = "", // 新 schema 移除此欄位
                    LoginCount = a.LoginCount ?? 0,
                    LastLoginTime = a.LastLoginTime,
                    IsActive = true
                })
                .ToListAsync();

            return Ok(new PagedResult<AccountDto>
            {
                TotalCount = totalCount,
                TotalPages = totalPages,
                CurrentPage = page,
                PageSize = pageSize,
                Data = accounts
            });
        }

        // POST: api/accounts (新增單筆資料)
        [HttpPost]
        public async Task<ActionResult<AccountDto>> CreateAccount(AccountDto dto)
        {
            if (await _context.Accounts.AnyAsync(a => a.EmpId == dto.EmpId))
            {
                return BadRequest("該員工編號已存在。");
            }

            var account = new Account
            {
                EmpId = dto.EmpId,
                Name = dto.Name,
                RoleLevel = "user",
                CanEditOthers = false
            };

            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAccounts), new { id = account.EmpId }, dto);
        }

        // PUT: api/accounts/5 (更新單筆資料)
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAccount(string id, AccountDto dto)
        {
            if (id != dto.EmpId) return BadRequest();

            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();

            account.Name = dto.Name;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AccountExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        // DELETE: api/accounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAccount(string id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();

            _context.Accounts.Remove(account);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/accounts/batch-import
        [HttpPost("batch-import")]
        public async Task<IActionResult> BatchImport([FromBody] List<AccountDto> accounts)
        {
            if (accounts == null || !accounts.Any()) return BadRequest("無資料可匯入");
            
            int inserted = 0;
            int updated = 0;

            foreach (var dto in accounts)
            {
                if (string.IsNullOrWhiteSpace(dto.EmpId)) continue;

                var existingAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.EmpId == dto.EmpId);
                
                if (existingAccount == null)
                {
                    _context.Accounts.Add(new Account
                    {
                        EmpId = dto.EmpId,
                        Name = dto.Name,
                        RoleLevel = "user",
                        CanEditOthers = false
                    });
                    inserted++;
                }
                else
                {
                    existingAccount.Name = dto.Name;
                    updated++;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"匯入成功。新增 {inserted} 筆，更新 {updated} 筆。" });
        }

        private bool AccountExists(string id)
        {
            return _context.Accounts.Any(e => e.EmpId == id);
        }
    }
}
