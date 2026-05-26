using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EQDashboard.Data;
using System.Threading.Tasks;

namespace EQDashboard.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MenusController : ControllerBase
    {
        private readonly AppDbContext _context;
        public MenusController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> Get() => Ok(await _context.Menus.ToListAsync());
    }

    [Route("api/[controller]")]
    [ApiController]
    public class RolesController : ControllerBase
    {
        private readonly AppDbContext _context;
        public RolesController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> Get() => Ok(await _context.Roles.ToListAsync());
    }

    [Route("api/[controller]")]
    [ApiController]
    public class FabsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public FabsController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> Get() => Ok(await _context.Fabs.ToListAsync());
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AppsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public AppsController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> Get() => Ok(await _context.Apps.ToListAsync());
    }

    [Route("api/[controller]")]
    [ApiController]
    public class RequestsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public RequestsController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> Get() => Ok(await _context.Requests.ToListAsync());
    }
}
