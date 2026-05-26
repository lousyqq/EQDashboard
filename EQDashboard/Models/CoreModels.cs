using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EQDashboard.Models
{
    public class Menu
    {
        [Key]
        [MaxLength(50)]
        public string MenuId { get; set; } = null!;
        public string? SysName { get; set; }
        public string? DisplayName { get; set; }
        public string? MenuMode { get; set; }
        public string? Url { get; set; }
        public string? TargetPage { get; set; }
        public string? OpenTarget { get; set; }
        public string? Icon { get; set; }
        public string? CreatedBy { get; set; }
        public bool? IsEnabled { get; set; }
        public bool? IsPoolItem { get; set; }
        public bool? IsEdited { get; set; }
        public int? GlobalOrder { get; set; }
    }

    public class Fab
    {
        [Key]
        [MaxLength(50)]
        public string FabId { get; set; } = null!;
        public string? FabName { get; set; }
        public string? DisplayName { get; set; }
        public string? DefaultLang { get; set; }
    }

    public class Role
    {
        [Key]
        [MaxLength(50)]
        public string RoleId { get; set; } = null!;
        public string? GroupName { get; set; }
    }

    public class Account
    {
        [Key]
        [MaxLength(50)]
        public string EmpId { get; set; } = null!;
        public string? Name { get; set; }
        public string? Department { get; set; }
        public string? RoleLevel { get; set; }
        public bool? CanEditOthers { get; set; }
        public int? LoginCount { get; set; }
        public DateTime? LastLoginTime { get; set; }
    }

    public class AppItem
    {
        [Key]
        [MaxLength(50)]
        public string AppId { get; set; } = null!;
        public string? MenuId { get; set; }
        public string? AppName { get; set; }
        public string? Url { get; set; }
        public string? IconBase64 { get; set; }
        public string? Target { get; set; }
    }

    public class Request
    {
        [Key]
        [MaxLength(50)]
        public string RequestId { get; set; } = null!;
        public string? EmpId { get; set; }
        public string? EmpName { get; set; }
        public string? Reason { get; set; }
        public long? Timestamp { get; set; }
        public string? Status { get; set; }
        public string? WithdrawReason { get; set; }
        public string? Reply { get; set; }
        public string? ReqType { get; set; }
        public string? Fab { get; set; }
    }

    public class PersonalSetting
    {
        [Key]
        [MaxLength(50)]
        public string EmpId { get; set; } = null!;
        public string? MenuId { get; set; }
        public bool? IsHidden { get; set; }
        public string? OpenTarget { get; set; }
        public string? Icon { get; set; }
        public int? SortOrder { get; set; }
    }
}
