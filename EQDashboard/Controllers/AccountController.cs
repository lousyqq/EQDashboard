using Microsoft.AspNetCore.Mvc;

namespace EQDashboard.Controllers
{
    public class AccountController : Controller
    {
        // 因為我們使用 SPA 單頁架構，登入畫面已內嵌在 Dashboard/Index 中
        // 若使用者意外輸入 /Account/Login 網址，自動幫他導向回主畫面
        public IActionResult Login()
        {
            return RedirectToAction("Index", "Dashboard");
        }
    }
}