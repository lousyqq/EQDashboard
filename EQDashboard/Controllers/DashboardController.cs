using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EQDashboard.Controllers
{
    [Authorize] // 保護整個 Controller，必須登入才能訪問
    public class DashboardController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}