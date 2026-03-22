using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EQDashboard.Controllers
{
	public class AccountController : Controller
	{
		[HttpGet]
		public IActionResult Login()
		{
			// 如果已經登入，直接跳轉到首頁
			if (User.Identity.IsAuthenticated)
			{
				return RedirectToAction("Index", "Dashboard");
			}
			return View();
		}

		[HttpPost]
		public async Task<IActionResult> Login(string empId, string password)
		{
			if (string.IsNullOrEmpty(empId))
			{
				ViewBag.Error = "請輸入工號";
				return View();
			}

			string role = "";
			string userName = "";

			// 模擬資料庫 RBAC 驗證邏輯
			if (empId.ToLower() == "admin")
			{
				role = "Admin";
				userName = "系統管理員 (John)";
			}
			else if (empId.ToLower() == "user")
			{
				role = "BasicUser";
				userName = "產線工程師 (Jane)";
			}
			else
			{
				ViewBag.Error = "登入失敗：請輸入 admin 或 user 進行測試。";
				return View();
			}

			// 建立 Claim (宣告)，包含身分與角色
			var claims = new List<Claim>
			{
				new Claim(ClaimTypes.NameIdentifier, empId),
				new Claim(ClaimTypes.Name, userName),
				new Claim(ClaimTypes.Role, role)
			};

			var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
			var authProperties = new AuthenticationProperties { IsPersistent = true };

			// 寫入 Cookie 完成登入
			await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity), authProperties);

			return RedirectToAction("Index", "Dashboard");
		}

		public async Task<IActionResult> Logout()
		{
			await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
			return RedirectToAction("Login");
		}
	}
}