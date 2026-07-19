# EQ Performance Dashboard - 專案說明文件 (AGENTS.md)

> 本文件提供 AI 助手在此專案下開發、修改、除錯所需的最小必要知識與規範（最新狀態快照）。
> **現役主線**：`EQDashboard.V2.Web`（ASP.NET Core .NET 9.0 + ES Modules 前端模組化 + 最小整合測試 `EQDashboard.V2.Web.Tests`）。

---

## 1. 專案定位與核心運行模式

- **環境與架構**：啟動 ASP.NET Core Kestrel/IIS，後端採用 Service 層與 DI 解耦，前端採用 ES Modules 模組化與 Bootstrap 5/Vanilla JS（全 CDN，無 npm/bundler）。
- **資料儲存與同步**：後端連接 MSSQL（`ConnectionStrings:EQDashboard`，DB 為 `EQDashboardV2`，Server `Sariel`）。所有 CRUD 異動自動靜默寫回 MSSQL；個人版面設定寫入 `PersonalSettings` 表並搭配 `LocalStorage` 快取；登入計數更新 `Accounts.LoginCount/LastLoginTime`。
- **身分驗證與管理模式**：Kestrel + Negotiate 自動偵測 Windows 桌機登入帳號（如 `00058897` 或 `UMC\00059987`），前端無手動帳密輸入 Tab 與登出按鈕。`appsettings.json`（`AuthSettings`）支援三核心配置：
  1. **`SimulatedAccount` (模擬帳號)**：可指定帳號（如 `yu-ting` 或 `00058897`）進行本地模擬驗證；若留空 (`""`) 則自動抓取 Windows 桌機登入身分。
  2. **`DefaultAdmins` (預設管理員防護)**：預設設定 `["yu-ting", "00058897", "00059987"]` 為管理員，當這些身分登入且 DB 中不存在或權限不足時，自動建立或升級為 `admin`，防止系統鎖死。
  3. **`OpenAccessMode` (開放瀏覽模式)**：當開啟 (`true`) 時，不在帳號管理名單內的新登入者預設為一般使用者（`roleLevel = "user"`, `Department = "一般使用者"`），自動加入 DB 帳號名單，並自動綁定所有角色權限群組（使可視廠區預設為所有廠區）；登入預設首頁不設定（為未設定，自動抓取第一個；登入網頁時預設停留 12A 廠區）；同時全站看板與廠區對所有人開放瀏覽（後端 `GetVisibleMenuIdsAsync` 回傳 null 不過濾、前端全放行）。當關閉 (`false`) 時，嚴格限 DB 帳號名單內的使用者登入與授權瀏覽。
- **應用集合 (App Grid) 權限隔離**：無論模式為何，無管理權限 (`canManageCurrentAppGrid`) 之一般使用者一律隱藏編輯/刪除圖示與操作端點。開啟方式維持全站一致（新視窗全螢幕或彈窗/IE 模式）。

---

## 2. 檔案與目錄結構 (Directory Structure)

```
C:\EQDashboard\EQDashboard\EQDashboard.V2.Web\
├── EQDashboard.V2.Web.sln              # 解決方案 (含 Web 專案 + Tests 整合測試)
├── EQDashboard.V2.Web.csproj           # 專案檔 (預設 glob 排除 Tests 目錄避免雙重編譯)
├── Program.cs                          # DI 註冊、Middleware Pipeline、CSP 安全標頭、健康檢查端點 (/health, /health/ready)
├── appsettings.json                    # ConnectionStrings:EQDashboard 與 AuthSettings 配置
├── Models\                             # 資料實體 (Entity)、DTOs 與 Settings
├── Data\                               # AppDbContext (ApplyConfigurationsFromAssembly) 與 Configurations\
├── Services\                           # 核心服務層 (Settings / Account / Auth / MenuAuth / IconStorage / Menu 等)
│   ├── InitialDataCacheInvalidator.cs  # Singleton 快取作廢與 ETag bump 中心
│   ├── CacheInvalidationInterceptor.cs # EF SaveChangesInterceptor 快取作廢安全網
│   └── SchemaBootstrap.cs            # 啟動時 idempotent 自我修復 DDL (補表/補欄位/補索引)
├── Controllers\                        # 薄 Controller 層 (Settings / Accounts / Menus / Roles / Fabs / Apps / Auth 等)
└── wwwroot\                            # 靜態檔案與前端 ES Modules
    ├── index.html                      # 唯一 UI 進入點 (<script type="module" src="js/main.js">)
    ├── partials\modals.html            # 動態 fetch 載入之 Bootstrap Modals
    ├── css\                            # variables.css / navbar.css / sidebar.css / components.css / responsive.css (RWD)
    └── js\                             # main.js / store.js (狀態中心) / api.js / auth.js
        ├── ui\                         # layout.js / navigation.js / dialogs.js
        ├── render\                     # sidebar.js / sidebar-item.js / tables.js / account-ui.js
        └── admin\                      # modal-utils.js / fab-manage.js / role-manage.js / account-manage.js 等
```

### ES Modules 前端模組規範
- `index.html` 僅引入 `main.js`，所有 JS 檔案間以 `import/export` 模組關聯。
- **`import` 必須絕對置頂**：嚴禁將 `import` 寫在函式或邏輯區塊內。任一語法錯誤會中斷整個模組圖導致畫面卡死。
- **模組作用域與事件綁定**：模組內部函式若需給 HTML inline `onclick="X()"` 使用，必須顯式掛載至全域：`window.X = X;`。
- **App Shell 與快取防禦 (`clearAppCache`)**：因 `index.html` 內嵌腳本會在 JS 載入前第一時間從 `localStorage` 讀取舊版 `app_shell_top_menus` / `app_shell_sidebar_menus`，且 `Ctrl+F5` 不會清空本地快取。凡執行 `syncDataToDB()`、RESTful 存檔 (`save*API`/`delete*API`)、切換帳號或登出時，皆需呼叫 `window.clearAppCache(preserveCurrentUser)` 自動清除殘留快照，確保畫面與資料庫最新狀態即時同步。
- **帳號即時同步與防呆 (`restoreLoginFromStorage` / `MyProfile`)**：後端 `/api/Auth/MyProfile`、`WhoAmI`、`Config` 均已設定 `Cache-Control: no-cache, no-store, must-revalidate` 標頭且前端以 `{ cache: 'no-store' }` 請求。當使用者按 `Ctrl + F5` 重新整理時，`restoreLoginFromStorage` 會比對 `window._currentServerEmpId` 進行雙重身分驗證，並透過 `Object.assign` 全欄位即時將 DB 最新身分與權限同步至 `localStorage`，保證不會殘留過期快取。

---

## 3. 資料庫結構與關聯模型 (Database Schema)

專案不使用 EF Migrations，資料表結構與實體索引由 `SchemaBootstrap.cs` 於系統啟動時執行冪等 (`IF NOT EXISTS` / `COL_LENGTH IS NULL`) 自我修復。

- **實體表 (7)**：`Menus`、`Fabs`、`Roles`、`Accounts`（含 `RoleLevel` / `CanEditOthers` / `LoginCount` / `LastLoginTime`）、`Apps`（圖示儲存）、`Requests`、`PersonalSettings`（複合 PK：`EmpId` + `MenuId`）。
- **關聯表 (10)**：`Map_Fab_Role`、`Map_Account_Role`、`Map_Account_ManageMenu`、`Map_Role_Menu`（含 `SortOrder`）、`Map_Menu_Structure`（父子樹狀，Restrict FK）、`Map_Account_DefaultPage`、`Map_Account_ExtraMenu`、`Map_Account_DenyMenu`、`Map_Menu_AllowAccount`、`Map_Menu_DenyAccount`。
- **Per-Fab 綁廠區覆寫表**：`Map_Account_ExtraMenu` 與 `Map_Account_DenyMenu` 之 PK 為 `(EmpId, FabId, MenuId)`，其中 `FabId` 儲存廠區名稱（如 `12A`，刻意不建 FK 以免多重 Cascade 路徑衝突）。
- **稽核與統計紀錄**：`UserActivityLogs`（操作稽核表）與 `DailyUserVisits`（每日活躍造訪統計表，複合 PK：`VisitDate` + `EmpId`），皆由 `SchemaBootstrap` 自動冪等建表與建置索引。
- **欄位命名映射**：前端 JS 全統一使用 CamelCase（如 `m.id`, `m.displayName`），後端 C# 與 DB 統一使用 PascalCase（如 `MenuId`, `DisplayName`）。`Accounts` 表存檔覆寫時，必須帶上 `LoginCount` 與 `LastLoginTime` 以免被洗成 NULL。
- **圖示儲存機制 (`IconBase64`)**：一律由 base64 轉為實體檔案存檔於 `wwwroot/images/icons/{guid}.{ext}`，DB 僅儲存 URL 路徑。統一透過 `IIconStorageService.SaveAsync`（檢驗 MIME 白名單與相對路徑正規化）與 `DeleteIfLocalUnreferencedAsync`（孤兒清理與參照檢查）處理，禁止 Controller 自行存檔。

---

## 4. API 規範與通訊設計

- **初始載入 (`GET /Settings/GetInitialData`)**：
  - 非 Admin 必須於後端由 `IMenuAuthService.GetVisibleMenuIdsAsync` 進行列級可見性過濾。
  - ** scope-to-own 規範**：無論 Admin 或一般使用者，對 `Accounts`、`PersonalSettings` 及 `Map_Account_*` 等帳號相關表，後端 `ISettingsService.GetInitialDataAsync(empId)` 一律以 `.Where(x => x.EmpId == empId)` 點查，只回傳登入者「自身的資料列」。**嚴禁移除自身資料列**（前端 `restoreLoginFromStorage` 與 `MyProfile` 需驗證並覆寫登入狀態）。
  - ETag 必須摻入身分與權限（`"{ETag}:{empId}:{isAdmin}"`）以避免瀏覽器快取於共用機台跨帳號串網回放。
- **帳號清單與明細管理 (Admin-Only REST API)**：
  - `GET /api/Accounts?page=&pageSize=&q=`：伺服器端分頁清單，`q` 搜尋 `EmpId`/`Name`/`Department` 時，**進入 DB 查詢前務必限制最大長度（`term.Length > 100 ? term.Substring(0, 100) : term`）**，避免 `nvarchar(4000)` 溢出觸發 SqlException 8152（字串被截斷）錯誤。
  - `GET /api/Accounts/{id}`：取得單一帳號完整明細（含管理授權、Extra/Deny 選單）。呼叫時 `{id}` **必須執行 `encodeURIComponent(id)`**，防止 Windows 網域工號中的反斜線 `\` 導致 URL 路由不匹配報 404。
  - `GET /api/Accounts/export`：匯出全量帳號資料供 Excel 備份。
- **自身設定懶載入 (`GET /api/Auth/MyProfile`)**：
  - 回傳目前登入使用者的完整設定與授權（含 `empId`, `name`, `department`, `loginCount`, `lastLoginTime`, `roleLevel`, `canEditOthers`, `assignedRoles`, `manageableMenus`, per-fab `extraMenus`/`denyMenus`, `defaultPages`），並帶有 `Cache-Control: no-cache, no-store, must-revalidate` 標頭以防瀏覽器快取。
  - 在前端 `fetchInitialDataFromDB` 與 `GetInitialData` 並行發送以節省 RTT。**全域 API 攔截器的 401 排除清單必須包含 `/api/Auth/MyProfile`**（連同 `/api/Auth/Login`、`/Settings/GetInitialData`、`/api/Auth/WhoAmI`），避免冷開頁時觸發誤判登出與擾民彈窗。
- **全站流量統計與使用率 (`AnalyticsController` - Admin-Only)**：
  - `GET /api/Analytics/UsageStats?days=N`：提供 DAU、MAU、全站註冊人數與近期平均活躍率 KPI，並返回每日趨勢、12個月趨勢與各部門/廠區活躍比率。
  - `GET /api/Analytics/details?page=&pageSize=&date=&dept=&q=`：分頁查詢每日個人造訪紀錄與首次/最後造訪時間。

---

## 5. C# 與 MSSQL 開發規範 (Strict Development Conventions)

**本節所有規範與命名原則為系統穩健運行之基石，進行後端與資料庫修改時必須 100% 嚴格遵循：**

### 5.1 C# 後端與 SQL 安全原則
1. **Controller 命名與結構**：Controller 統一命名為 `XxxController : Controller`，維持薄層處理路由與請求，複雜業務邏輯封裝至 `Services/`。
2. **SQL 參數化與防隱碼攻擊 (SQL Parameterization)**：所有原生 ADO.NET (`Microsoft.Data.SqlClient`) 或 DDL 查詢中，針對外部輸入或篩選值一律嚴格使用 `SqlParameter`（如 `@p` 或 `@EmpId`）。**嚴禁使用 C# 字串拼接組裝 SQL 數值條件**。（於 `SchemaBootstrap.cs` DDL 內硬編碼之已知系統表名/欄位白名單除外）。
3. **交易管理與重試策略 (Transactions & ExecutionStrategy)**：
   - 所有「先刪除舊關聯 mapping、再寫入新關聯 mapping」的多步驟寫入（如 `RolesController.UpdateRole`、`AccountService.UpdateAccountAsync`、`MenusController.BatchUpdateMenus`、`FabsController.UpdateFab`、`PersonalSettingsController.SavePersonalSettings`）一律必須在原子交易內執行。
   - 因 DbContext 啟用了 `EnableRetryOnFailure`，開啟手動交易必須透過執行策略封裝：
     ```csharp
     var strategy = _context.Database.CreateExecutionStrategy();
     await strategy.ExecuteAsync(async () => {
         using var trans = await _context.Database.BeginTransactionAsync();
         // 執行 CRUD 動作與 SaveChangesAsync
         await trans.CommitAsync();
     });
     ```
4. **複合 PK 關聯表的「先刪後寫」兩步驟 SaveChanges 規範**：
   - 針對複合主鍵表（如 `Map_Role_Menu`、`Map_Fab_Role`、`PersonalSettings`），當要替換關聯記錄時，**必須先呼叫 `RemoveRange(oldItems)` 並執行一次 `await _context.SaveChangesAsync()`，確實自 DB 與 ChangeTracker 刪除舊列後，才能 `Add(newItems)` 並再次 `SaveChangesAsync()`**。
   - 若在同一 SaveChanges 內同時 Remove 又 Add 相同複合 PK 值，EF 會觸發 `Identity Map` 追蹤衝突（Another instance with the same key value is already being tracked）。
   - 寫入前對來源 IDs 執行去重操作（使用 `HashSet` 或 `.Distinct()`），防止同一批請求傳入重複鍵。
5. **外鍵關聯參照預檢 (`ValidateMappingRefsAsync`)**：
   - 寫入任何 `Map_*` 關聯表前，一律先行驗證對應的 `RoleId`、`MenuId` 是否真實存在於 `Roles`、`Menus` 表中。避免 DB 拋出 500 FK 違反錯誤，改由後端乾淨回傳 400 BadRequest 提示。
6. **索引宣告與查詢覆蓋 (Indexes Definition)**：
   - 所有物理資料庫索引統一集中於 `SchemaBootstrap.EnsureIndexesAsync` 內以冪等 SQL（`IF NOT EXISTS(SELECT * FROM sys.indexes WHERE name='...') CREATE INDEX ...`）宣告建立。**嚴禁使用 EF Core 的 `HasIndex` 屬性**（無 EF Migrations 時對既有 DB 為無效 metadata）。
   - 帳號搜尋必須利用覆蓋索引 `IX_Accounts_Search (Name, Department)` 搭配主鍵 `EmpId` 進行優化點查。
7. **單次往返 UPDATE + OUTPUT 原子操作 (Atomic UPDATE OUTPUT)**：
   - 「更新紀錄並取得新值」之場景，嚴禁採取「UPDATE 後再 SELECT」的兩回合查詢。一律合併為單一 SQL 語句配合 `OUTPUT INSERTED.*` 執行：
     ```sql
     UPDATE Accounts SET LoginCount = ISNULL(LoginCount, 0) + 1, LastLoginTime = GETDATE()
     OUTPUT ISNULL(INSERTED.LoginCount, 0), INSERTED.LastLoginTime
     WHERE EmpId = @EmpId;
     ```
   - 若 `ExecuteReaderAsync` 無列回傳，即代表 `WHERE` 條件未命中（帳號不存在），直接精準判斷並維持線程一致性。
8. **快取作廢與 ETag 更新機制 (`InvalidateInitialDataCache`)**：
   - 凡涉及 `Menus`、`Fabs`、`Roles` 或 `Map_*` 權限結構異動之寫入端點，完成後必呼叫 `IInitialDataCacheInvalidator.InvalidateInitialDataCache()`（或 Volatile 版）。
   - 此動作為雙重關鍵（Double Load-Bearing）：除了清除快取記憶體，亦會推進 `_currentETag` 版本，從而自動作廢 `visibleMenus:{ETag}:{empId}` 快取。
   - `CacheInvalidationInterceptor` 作為 EF Core 的 SaveChanges 攔截器安全網，會對 EF 追蹤實體異動自動觸發快取作廢；但若是**原生 ADO.NET / raw SQL 寫入則不會經過 EF 攔截器，必須手動顯式呼叫 `InvalidateInitialDataCache()`**。
9. **外鍵與約束啟用規範 (`CHECK CONSTRAINT ALL`)**：
   - 重新啟用 DB Check constraints 或 FK constraints 時，一律採用 `WITH CHECK CHECK CONSTRAINT ALL` 進行完整校驗（Trusted Constraint）。**嚴禁使用 `WITH NOCHECK CHECK`**（會導致 Untrusted 狀態及潛在孤兒記錄留存）。
10. **大批量寫入禁用 `SqlBulkCopy`**：
    - 禁止為追求效能將參數化批次 `INSERT` 改寫為 `SqlBulkCopy`。因專案主機 (`Sariel`) 僅 6GB RAM，Bulk Copy 需要大量 SQL Memory Grant，於高記憶體壓力下易卡死在 `RESOURCE_SEMAPHORE` 等待。
11. **DbContext 池化規範 (`AddDbContextPool`)**：
    - `Program.cs` 使用 `AddDbContextPool<AppDbContext>` 以重用連線池與減少 GC。
    - **池化硬性規範**：① DbContext 建構子只允許注入 `DbContextOptions<AppDbContext>`，**嚴禁注入任何 Scoped 服務**；② **嚴禁新增任何可變的實例欄位或狀態**（池化歸還時僅重設 ChangeTracker，自訂狀態會跨請求外洩）；③ **嚴禁在 DbContext 實例執行環境變更**（如 `SetCommandTimeout` 或 `QueryTrackingBehavior` 異動）。
12. **查詢拆分規範 (`AsSplitQuery`)**：
    - 凡 LINQ 查詢內含有 **2 個或以上 Collection `Include`**（包含多集合關聯展開），一律於鏈式呼叫結尾加上 `.AsSplitQuery()`，防止 Cartesian 乘積爆發與記憶體浪費。
13. **唯讀查詢唯讀追蹤規範 (`AsNoTracking`)**：
    - 任何僅用於讀取、實體序列化回傳 JSON 且不打算寫回 DB 的 GET 查詢，一律追加 `.AsNoTracking()` 以節省追蹤開銷。
    - **嚴禁在「查詢並即將透過 SaveChanges 修改」的寫入流程中使用 `.AsNoTracking()`**（實體未被追蹤將導致 `SaveChanges` 靜默無效）。
14. **使用者工號與 IP 取得規範**：
    - 取得目前登入者 `EmpId` 必須唯一透過 `User.FindFirst(ClaimTypes.NameIdentifier)?.Value`。**嚴禁使用 `User.Identity.Name`**（該值為人員姓名，會導致授權與委派判定失敗）。
    - 讀取用戶端 IP 必須走 `ClientIpHelper.GetClientIp(HttpContext)`；該 IP 僅用於 `UserActivityLogs` 稽核，不可作為授權依據。
15. **狀態碼與日誌記錄 (`ILogger<T>`)**：
    - 寫入端點失敗處理：資源不存在回傳 `404 NotFound`；業務驗證、格式錯誤或授權阻擋一律回傳 `400 BadRequest`。
    - 系統除錯與例外記錄，一律使用 Constructor 注入的 `ILogger<T>`。**嚴禁使用 `Console.WriteLine` 或 `Console.Error.WriteLine`**（IIS 下標準輸出無法捕獲，且 Serilog 無法接管）。
16. **時間與跨時區一致性 (`GETDATE()`)**：
    - 凡涉及每日造訪統計或跨日比對的查詢（如 `DailyUserVisits`），計算「今天」的基準必須以 SQL Server 資料庫端時間 (`CONVERT(date, GETDATE())`) 為準，防範 App Server 與 SQL Server 時區不一致導致的資料偏差。

---

## 6. 前端開發規範與安全規範 (Frontend Conventions & Security)

### 6.1 授權、CSRF 與 CSP 安全控制
- **後端 Authorization baseline**：所有 Controller 預設標註最寬鬆之 class-level `[Authorize]`；僅管理員限定功能再於 Action 追加 `[Authorize(Roles="admin")]`。
- **CSRF 驗證位置 (`ValidateRequestAsync`)**：`Program.cs` 內的 Antiforgery CSRF 驗證 Middleware **必須配置於 `UseAuthentication()` 與 `UseAuthorization()` 之後**。因為 ASP.NET Token 綁定使用者的 Identity Claims，若放於驗證前會拿匿名 Identity 比對 Token 導致一律 `Invalid Token`。
- **前端 CSRF 雙重保障**：登入完成後 (`auth.js`) 自動執行 `refreshCsrfToken()` 重取身分 Token；且全域 `api.js` 攔截器對寫入 API 報 400 且 body 包含 `Invalid Token` 時，自動非同步刷新 Token 並重試 1 次。
- **Content-Security-Policy (`Program.cs`)**：系統架構需支援 Bootstrap/DataTables 動態注入與 inline styles/handlers，因此 CSP 標頭**必須包含 `'unsafe-inline'`**；同時設定嚴格的 CDN 白名單 (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `cdn.datatables.net`, `code.jquery.com`) 與 `frame-src` 允許外部看板 iframe 嵌入。
- **CDN Subresource Integrity (SRI)**：所有 CDN `<script>`/`<link>` 必須帶有正確的 `integrity="sha384-..."` 與 `crossorigin="anonymous"`。變更 CDN 版本時務必重新計算並同步 SHA-384 Base64 校驗碼。

### 6.2 前端 JS 核心與 UI 控制
- **狀態管理**：全域變數封裝於 `store.js` (`appState`)，其他模組一律以 `import { appState } from './store.js'` 讀寫。
- **回饋訊息分流 (`showToast` vs `customAlert`)**：「成功/資訊」類回饋一律走 `ui/dialogs.js` 的非阻斷式 `showToast(msg, type, delay, isHtml)`（右上角 Bootstrap Toast，自動消失，type 支援 `success`/`info`/`warning`/`error`）；**錯誤訊息與需要使用者決策的情境才走 `customAlert` / `customConfirm`**。嚴禁再為成功訊息新增阻斷式 Modal。
- **JS 快取破解版本碼一致性 (`?v=`)**：`index.html` 的 `<script src>` 與所有 JS 模組內部 `import ... ?v=` 版本碼必須**全站完全一致**（目前為 `20260719c`）。若不一致，同一模組會被瀏覽器以不同 query 字串重複實例化兩份，造成狀態分裂與事件重複綁定（曾發生 main.js 用 `h`、其餘用 `k` 的雙載問題）。改版時一律全域取代。
- **查詢篩選 Enter 送出**：操作紀錄與流量明細的篩選輸入框已綁定 Enter 直接送出查詢；新查詢必須重設回第 1 頁（參考 `searchActivityLogs()`），避免停留在舊查詢頁碼撈到空頁。
- **i18n 全量覆蓋規範**：新增任何 UI 文字時，靜態 HTML 一律掛 `data-i18n`（placeholder 用 `data-i18n-placeholder`）並於 `config.js` 的 `i18n` 字典**同時補齊 zh/en/ja 三語 key**；JS 動態產生的字串一律走 `t(key, fallback)`，含數值的訊息以 `{0}`/`{1}` 模板 key 搭配 `.replace()` 組字。含圖示的標題/按鈕須把文字包進 `<span data-i18n>`，避免 innerHTML 替換吃掉圖示。操作紀錄與流量統計頁已全量覆蓋，勿再新增硬編中文。
- **表格載入骨架屏 (`skeletonRows`)**：查詢型表格（操作紀錄、流量統計）的載入狀態一律使用 `ui/dialogs.js` 的 `skeletonRows(colCount, rowCount)` 產生 placeholder-glow 骨架列，勿再新增「spinner + 查詢中」文字列。
- **sticky 表頭唯一宣告處**：操作紀錄表格的 sticky 表頭樣式只宣告於 `components.css` 的 `#page-activity-log .table-responsive thead th`，嚴禁在 index.html 以內嵌 `<style>` 或 th inline style 重複定義。
- **意見箱 (`openFeedbackPage`)**：導覽列意見箱連結導向系統既有「需求申請」頁（`ui/navigation.js`），非外部信箱；管理員於「申請審核管理」查看與回覆。
- **RWD 斷點規範 (`responsive.css`)**：所有 `@media` 斷點覆寫**集中於 `css/responsive.css`**（≤992px 側欄改浮層 + `#sidebar-backdrop` 遮罩、≤768px 手機壓縮、≤480px 窄幅），勿散落於其他 CSS 檔；對應 JS 行為（初載/縮窄自動收合、遮罩點擊收合、點選連結項後收合、跨斷點還原）集中在 `ui/layout.js` 的 RWD 區塊（斷點常數 `RWD_SIDEBAR_BREAKPOINT = 992` 需與 CSS 一致）。
- **看板排序 (`batchSaveMenusAPI`)**：系統選單排序拖曳一律送至 RESTful 批次端點處理，禁用 Excel 全量覆寫；個人自訂導覽列排序走 `/api/PersonalSettings`，在個人 (`personal`) 模式下，根層排序必須 fallback 對齊 `dedupedInitIds` 索引，確保還原後與系統版面順序一致。
- **JS 字串跳脫 (`_jsArg`)、HTML 轉義 (`escHtml`) 與 URL 編碼 (`encodeURIComponent`)**：
  - 將 ID 寫入 HTML inline `onclick="func('ID')"` 前，必須先透過 `_jsArg()` 進行 JS 與 HTML 轉義，否則 Windows 網域 ID (`SARIEL\yu-tinglin`) 內的 `\` 會被當成跳脫字元吃掉而無法觸發點擊事件。
  - 將資料庫回傳的使用者資料（如 `empName`, `department`, `err.message` 等）動態拼接入 `innerHTML` 時，必須調用 `escHtml(s)` 實體跳脫，防範 Stored / Reflected XSS。
  - 呼叫後端 REST API 時，URL 上的 ID 參數皆須套用 `encodeURIComponent(id)` 進行編碼。
- **表格與挑選器機制**：
  - `renderAccountTable` 是專案唯一的 `serverSide:true` DataTable，禁止前端改回記憶體分頁。
  - 預設看板挑選器 (`openMenuSelector`) 支援選取「資料夾 (`folder`)」作為預設首頁；在判斷選單權限與展開子項時，必須檢查整個 `parentIds` 陣列（多父節點支援），同時最上層 Root 判定必須同時驗證 `(!cleanId(m.parentId)) && (m.parentIds||[]).filter(Boolean).length===0`。
  - 樹狀選單產生器 (`tbAddFolder`/`tbAddLink`) 中，模板字面值內引用的任何 `${xxxHtml}` 變數都必須於宣告區前置使用 `const` 定義清楚。

---

## 7. 關鍵模組與函式對照表

| 函式名稱 | 所在模組位置 | 主要職責與說明 |
| :--- | :--- | :--- |
| `getAllowedIdsWithHierarchy` / `getMenuPermissions` | `render/sidebar.js` | 權限階層展開、三層授權判定 (`isMyOwn` / `isUnderDelegated` / `canEditOthers`) |
| `renderSidebarMenus` / `filterSidebarMenus` | `render/sidebar.js` | 渲染側邊欄、上方導覽列生成、即時搜尋過濾 |
| `switchLayoutMode` / `togglePin` / `toggleSidebar` | `ui/layout.js` | 系統/個人 (`personal`) 導覽列切換、側欄釘選控制 |
| `goDefaultHome` | `ui/navigation.js` | 導覽至帳號預設首頁（含 folder 遞迴展開至第一筆可視看板）|
| `customAlert` / `customConfirm` | `ui/dialogs.js` | 全域 Bootstrap 提示框與確認框封裝（錯誤與決策情境用）|
| `showToast` | `ui/dialogs.js` | 非阻斷式右上角 Toast，成功/資訊類回饋專用（自動消失）|
| `skeletonRows` | `ui/dialogs.js` | 表格載入骨架屏（Bootstrap placeholder-glow），取代 spinner 文字列 |
| `openFeedbackPage` | `ui/navigation.js` | 意見箱入口：導向「需求申請」頁（管理員於申請審核管理回覆）|
| `saveMenuNodeItem` / `deleteMenuNodeItem` | `admin/menu-manage.js` | 看板選單節點 CRUD（執行完成後不重新跳轉，僅原地更新 UI）|
| `createWorkbookData` / `processAndSaveWorkbook` | `admin/misc-manage.js` | Excel 全量設定匯出（非同步 API 取整表）與匯入 |
| `SaveAsync` / `DeleteIfLocalUnreferencedAsync` | `Services/IconStorageService.cs` | base64 寫檔、孤兒清理、路徑安全檢查 |

---

## 8. 當前開放待辦事項 (Active Tasks)

- [~] **本地版控追蹤清理**：確保 `bin/`, `obj/`, `.vs/`, `App_Data/` 不進版控，並執行 `git add .` 與 commit 保存最新狀態。
- [ ] **DataProtection 金鑰輪換**：清除歷史外洩的 `App_Data/keys/*` 金鑰檔案並重啟系統產生全新金鑰（會使現有 Sessions 失效）。
- [ ] **資料量成長長期規劃 (可選)**：當系統看板總量與權限筆數擴增至數千筆規模時，評估增加 Menu 目標分類檢索、側欄樹狀非同步 lazy-loading 及分廠 on-demand 載入。

---

## 🔄 每輪對話自動覆盤與 DB 同步規範 (Mandatory Protocol)

1. **同步更新 `AGENTS.md` 與 `memory.md`**：修改程式碼或完成任務後，自動檢視並同步此二文件的最新狀態，刪除過時事項。
2. **同步更新 `專案架構.md`**：當有檔案增刪、移動或核心職責調整時，必須同步更新架構樹與說明。
3. **資料庫架構變動與遠端主機同步規範 (`DB_Table.md` & SQL Script - 嚴格遵從)**：
   - 使用者的遠端主機已建有正式資料庫並存有業務資料。
   - **凡任務涉及到任何 DB 架構異動**（如 `SchemaBootstrap.cs`、實體欄位、資料表或索引增刪修）：
     1. 必須同步修改 `DB_Table.md` 上方的資料表定義快照。
     2. **必須在專案目錄下產生一份增量異動 SQL 腳本檔案 (`.sql`)**（採相容既有資料與 `IF NOT EXISTS` 冪等 DDL 語法）。
     3. **必須於 `DB_Table.md` 結尾「5. 架構異動與增量 SQL 紀錄 (Schema Changelog)」追加當日日期 (`YYYY-MM-DD`) 與 `.sql` 檔名**，供遠端主機無縫同步。
4. **回覆通知**：於對話最後註明 `*已自動更新 AGENTS.md 與 memory.md*`（若有產出 DB SQL 檔亦一併列出）。
