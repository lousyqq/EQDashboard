using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EQDashboard.Controllers
{
	[Authorize] // 整個 Controller 都需要登入才能訪問
	public class DashboardController : Controller
	{
		// 1. 首頁 (所有人可見)
		public IActionResult Index()
		{
			return View();
		}

		// 2. FDC 報表 (僅限 Admin 角色可見)
		[Authorize(Roles = "Admin")]
		public IActionResult FdcIndex()
		{
			return View();
		}

		// 3. 權限申請 (所有人可見)
		public IActionResult ApplyAccess()
		{
			return View();
		}
	}
}