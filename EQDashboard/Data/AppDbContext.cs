using Microsoft.EntityFrameworkCore;
using EQDashboard.Models;

namespace EQDashboard.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // 定義資料庫的實體映射表
        public DbSet<Account> Accounts { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Menu> Menus { get; set; }
        public DbSet<Fab> Fabs { get; set; }
        public DbSet<AppItem> Apps { get; set; }
        public DbSet<Request> Requests { get; set; }
        public DbSet<PersonalSetting> PersonalSettings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            // EmpId 已是 Primary Key，無需額外 Unique Index
        }
    }
}
