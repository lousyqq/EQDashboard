using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// 加入 MVC 控制器與視圖服務
builder.Services.AddControllersWithViews();

var app = builder.Build();

// 設定 HTTP 要求管線
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Dashboard/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// 【關鍵修正】：將預設起始路由指向 DashboardController 的 Index
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

app.Run();