-- =========================================
-- 1. 建立資料表 (對應原本的 Excel 各個 Sheet)
-- =========================================




-- 系統選單表
CREATE TABLE Menus (
    MenuId NVARCHAR(50) PRIMARY KEY,
    SysName NVARCHAR(100),
    DisplayName NVARCHAR(100),
    MenuMode NVARCHAR(20),
    Url NVARCHAR(500),
    TargetPage NVARCHAR(100),
    OpenTarget NVARCHAR(20),
    Icon NVARCHAR(100),
    CreatedBy NVARCHAR(50),
    IsEnabled BIT,
    IsPoolItem BIT,
    IsEdited BIT,
    GlobalOrder INT
);

-- 廠區表
CREATE TABLE Fabs (
    FabId NVARCHAR(50) PRIMARY KEY,
    FabName NVARCHAR(50),
    DisplayName NVARCHAR(100),
    DefaultLang NVARCHAR(10)
);

-- 角色表
CREATE TABLE Roles (
    RoleId NVARCHAR(50) PRIMARY KEY,
    GroupName NVARCHAR(100)
);

-- 帳號/使用者表
CREATE TABLE Accounts (
    EmpId NVARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(100),
    Department NVARCHAR(100),
    RoleLevel NVARCHAR(20),
    CanEditOthers BIT
);

-- 應用程式清單
CREATE TABLE Apps (
    AppId NVARCHAR(50) PRIMARY KEY,
    MenuId NVARCHAR(50),
    AppName NVARCHAR(100),
    Url NVARCHAR(500),
    IconBase64 VARCHAR(MAX), -- 存放 Base64 圖片
    Target NVARCHAR(20)
);

-- 權限申請單
-- ① Requests 補上申請類別與廠區欄位
CREATE TABLE Requests (
    RequestId NVARCHAR(50) PRIMARY KEY,
    EmpId NVARCHAR(50),
    EmpName NVARCHAR(100),
    Reason NVARCHAR(500),
    Timestamp BIGINT, -- 使用 epoch 毫秒
    Status NVARCHAR(20),
    WithdrawReason NVARCHAR(500),
    Reply NVARCHAR(500),
    ReqType NVARCHAR(50),
    Fab NVARCHAR(50);
);

-- 關聯表：廠區與角色
CREATE TABLE Map_Fab_Role (
    FabId NVARCHAR(50),
    RoleId NVARCHAR(50),
    PRIMARY KEY (FabId, RoleId)
);

-- 關聯表：帳號與角色
CREATE TABLE Map_Account_Role (
    EmpId NVARCHAR(50),
    RoleId NVARCHAR(50),
    PRIMARY KEY (EmpId, RoleId)
);

-- 關聯表：帳號與管理選單權限
CREATE TABLE Map_Account_ManageMenu (
    EmpId NVARCHAR(50),
    MenuId NVARCHAR(50),
    PRIMARY KEY (EmpId, MenuId)
);

-- 關聯表：角色與選單 (含排序)
CREATE TABLE Map_Role_Menu (
    RoleId NVARCHAR(50),
    MenuId NVARCHAR(50),
    SortOrder INT,
    PRIMARY KEY (RoleId, MenuId)
);

-- 關聯表：選單階層結構 (父子選單)
CREATE TABLE Map_Menu_Structure (
    ParentMenuId NVARCHAR(50),
    ChildMenuId NVARCHAR(50),
    SortOrder INT,
    PRIMARY KEY (ParentMenuId, ChildMenuId)
);

-- 關聯表：使用者預設首頁
CREATE TABLE Map_Account_DefaultPage (
    EmpId NVARCHAR(50),
    FabId NVARCHAR(50),
    MenuId NVARCHAR(50),
    PRIMARY KEY (EmpId, FabId)
);

-- 使用者個人化設定
CREATE TABLE PersonalSettings (
    EmpId NVARCHAR(50),
    MenuId NVARCHAR(50),
    IsHidden BIT,
    OpenTarget NVARCHAR(20),
    Icon NVARCHAR(100),
    SortOrder INT,
    PRIMARY KEY (EmpId, MenuId)
);

-- 說明：建立完上述 Table 後，您可以使用 SQL Server Management Studio (SSMS) 
-- 的「匯入資料」功能，直接將您原本的 CSV 或 Excel 檔案對應匯入至這些 Table 中。

-- 寫入廠區
INSERT INTO Fabs (FabId, FabName, DisplayName, DefaultLang) VALUES
('fab_12a', '12A', '12A', 'zh'),
('fab_12m', '12M', '12M', 'ja'),
('fab_12i', '12i', '12i', 'en');

-- 寫入群組
INSERT INTO Roles (RoleId, GroupName) VALUES
('role_1', '12A 完整模組'),
('role_2', '12M 專用模組'),
('role_3', '12i 專用模組');

-- 寫入帳號 (讓您可以登入)
INSERT INTO Accounts (EmpId, Name, Department, RoleLevel, CanEditOthers) VALUES
('admin', '系統管理員', '資訊處', 'admin', 1),
('user', '一般使用者', '製造部', 'user', 0);

-- 寫入帳號與群組關聯
INSERT INTO Map_Account_Role (EmpId, RoleId) VALUES
('admin', 'role_1'),
('admin', 'role_2'),
('admin', 'role_3'),
('user', 'role_1'),
('user', 'role_2');

-- ② 所有可能存放 Base64 或長文字的欄位擴充
ALTER TABLE Menus ALTER COLUMN Icon NVARCHAR(MAX);
ALTER TABLE Menus ALTER COLUMN Url NVARCHAR(MAX);
ALTER TABLE PersonalSettings ALTER COLUMN Icon NVARCHAR(MAX);
ALTER TABLE Requests ALTER COLUMN Reason NVARCHAR(MAX);
ALTER TABLE Requests ALTER COLUMN WithdrawReason NVARCHAR(MAX);
ALTER TABLE Requests ALTER COLUMN Reply NVARCHAR(MAX);
ALTER TABLE Apps ALTER COLUMN Url NVARCHAR(MAX);