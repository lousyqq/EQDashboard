using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

// 加入 MVC 服務
builder.Services.AddControllersWithViews();

// 註冊 Cookie 身分驗證服務
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
	.AddCookie(options =>
	{
		options.LoginPath = "/Account/Login";         // 尚未登入時導向的頁面
		options.AccessDeniedPath = "/Account/Login";  // 權限不足時導向的頁面
		options.ExpireTimeSpan = TimeSpan.FromHours(8);
	});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
	app.UseExceptionHandler("/Home/Error");
	app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// 啟用身分驗證與授權 (順序不可變)
app.UseAuthentication();
app.UseAuthorization();

// 設定預設路由導向 Login 或是 Dashboard
app.MapControllerRoute(
	name: "default",
	pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();