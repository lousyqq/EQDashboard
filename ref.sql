-- 1. 建立 TaskCenter 資料表 (主表 - 存放主要需求資訊)
CREATE TABLE TaskCenter (
    RegId INT IDENTITY(1,1) PRIMARY KEY, -- 自動遞增的流水號
    RegDate DATE NOT NULL,               -- 註冊日期
    Status NVARCHAR(50) NOT NULL,        -- 狀態 (處理中/已上線/缺欄位)
    Department NVARCHAR(50),             -- DEPT
    Section NVARCHAR(50),                -- SECTION
    Applicant NVARCHAR(100),             -- 申請人
    Description NVARCHAR(MAX),           -- 需求摘要
    Owner NVARCHAR(100),                 -- 處理人員
    Benefit FLOAT DEFAULT 0,             -- 效益(MP/年)
    DBCat NVARCHAR(100),                 -- DBCat
    TCD NVARCHAR(MAX),                   -- TCD
    AppLink NVARCHAR(MAX),               -- App LINK
    DataSource NVARCHAR(MAX)             -- Data Source (SQL語法)
    
    -- 注意：已經將原本硬編碼的 DF1~PTI 等 17 個欄位移除，改由 TaskStation 表格管理
);

-- 2. 建立 TaskStation 資料表 (明細表 - 存放機台站點設定)
CREATE TABLE TaskStation (
    StationId INT IDENTITY(1,1) PRIMARY KEY,
    TaskRegId INT NOT NULL,                 -- 關聯到 TaskCenter 的 RegId (Foreign Key)
    StationName NVARCHAR(20) NOT NULL,      -- 站點名稱 (例如: 'DF1', 'LT3', 'PTI' 等)
    MpValue NVARCHAR(100),                  -- 數值或標記 (考量前端可能輸入 'V' 或 '0.035'，使用 NVARCHAR 較彈性)
    UrlLink NVARCHAR(MAX),                  -- 專屬連結 URL
    
    -- 設定外鍵約束，當主表的任務被刪除時，連帶刪除這裡的站點資料 (Cascade Delete)
    CONSTRAINT FK_TaskStation_TaskCenter 
        FOREIGN KEY (TaskRegId) 
        REFERENCES TaskCenter(RegId) 
        ON DELETE CASCADE
);