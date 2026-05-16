var builder = WebApplication.CreateBuilder(args);

// 加入控制器支援 (供 SettingsController API 使用)
builder.Services.AddControllersWithViews();

var app = builder.Build();

app.UseHttpsRedirection();

// ⭐️ 關鍵 1：設定預設檔案 (伺服器啟動時會自動去 wwwroot 尋找 index.html)
app.UseDefaultFiles();

// ⭐️ 關鍵 2：啟用靜態檔案 (允許瀏覽器讀取 wwwroot 裡面的 html, css, js)
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();

// 註冊 API 路由 (讓前端 fetch 能對應到 Controller/Action)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();