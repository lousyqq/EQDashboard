using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

// 註冊 Cookie 身分驗證，設定登入與登出路徑
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/Login";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
    });

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts(); // 啟用嚴格傳輸安全性
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// 啟用身分驗證與授權 (順序不可對調)
app.UseAuthentication();
app.UseAuthorization();

// 預設路由：將首頁指向 Dashboard/Index
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

app.Run();