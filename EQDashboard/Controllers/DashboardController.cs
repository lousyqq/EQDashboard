using Microsoft.AspNetCore.Mvc;

namespace EQDashboard.Controllers
{
    public class DashboardController : Controller
    {
        // 系統主頁 (包含登入覆蓋層與所有 JS 互動)
        public IActionResult Index()
        {
            return View();
        }

        // FDC 看板 (供內部 Iframe 呼叫載入使用)
        public IActionResult FdcIndex()
        {
            return View();
        }

        // 若您之後有建立權限申請頁面，可放開此註解
        /*
        public IActionResult ApplyAccess()
        {
            return View();
        }
        */
    }
}