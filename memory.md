# 專案記憶庫 (memory.md)

> 現況快照與開發指引（非逐日流水帳）。依據最新架構狀態整理，保留當前系統運作必備的核心機制、C#/MSSQL 開發規範、安全陷阱以及當前待辦事項。

---

## 🏗️ 1. 當前系統核心與架構概況

- **專案主線**：`EQDashboard.V2.Web`（ASP.NET Core .NET 9.0 + ES Modules 前端 + Bootstrap 5/jQuery CDN）。
- **資料儲存與連線**：使用 MSSQL（`ConnectionStrings:EQDashboard`，資料庫 `EQDashboardV2`，伺服器 `Sariel`）。CRUD 異動即時自動寫回 DB；`PersonalSettings` 存放使用者自訂上方導覽列順序與狀態，並搭配本地 LocalStorage 快取。
- **身分驗證模式 (`AuthSettings`)**：
  - Kestrel + Negotiate Windows 驗證自動登入，UI 無手動帳密 Tab 與登出按鈕。
  - `SimulatedAccount`：指定帳號進行本地模擬登入；留空則自動抓取桌機身分。
  - `DefaultAdmins`：預設管理員名單 (`["yu-ting", "00058897", "00059987"]`)，自動升級以防鎖死。
  - `OpenAccessMode`：開啟 (`true`) 時，新登入帳號預設為 `user`，並將預設首頁 (`Map_Account_DefaultPage`) 自動指向 **12A 廠區第一個選單第一筆頁面**，全站廠區與看板對外開放；關閉 (`false`) 時則嚴格遵循 DB 帳號管理與選單權限授權。
  - 應用集合 (App Grid) 權限隔離不分模式生效，無 `canManageCurrentAppGrid` 權限者一律隱藏管理操作按鈕。
- **資料架構自我修復 (`SchemaBootstrap`)**：系統不使用 EF Migrations，而由 `SchemaBootstrap.cs` 在啟動時以冪等 T-SQL (`IF NOT EXISTS` / `COL_LENGTH IS NULL`) 自動檢查並修復資料表、欄位與實體索引。
- **圖示儲存與清理 (`IIconStorageService`)**：看板與應用程式圖示寫入一律將 Base64 轉為檔案保存於 `wwwroot/images/icons/{guid}.{ext}`，DB 僅存相對 URL 路徑。透過 `IIconStorageService.SaveAsync`（MIME 白名單/相對路徑正規化）與 `DeleteIfLocalUnreferencedAsync`（孤兒檢驗清理）嚴格管控。
- **操作稽核紀錄 (`ActivityLogger`)**：中間件攔截非 GET 操作，寫入非阻塞記憶體佇列 `ActivityLogQueue`（滿載告警不丟棄），再由 `ActivityLogProcessor` 背景服務批次寫入 MSSQL `UserActivityLogs` 表。
- **造訪流量與使用率統計 (`AnalyticsController`)**：專屬統計表 `DailyUserVisits`（由 `IX_DailyUserVisits_Date_Dept` 索引加速點查與聚合），採用單筆複合主鍵 `(VisitDate, EmpId)` 搭配 `UPDATE...IF @@ROWCOUNT=0 INSERT` 冪等記錄。每日進入自動 upsert 並累加 `VisitCount`，提供管理員 UI（`#page-traffic-stats`）即時觀測全站 DAU/MAU 曲線、各部門活躍比率與每日造訪明細。
- **資料初始載入與 scope-to-own 規範**：`GET /Settings/GetInitialData` 針對非 Admin 會依據 `IMenuAuthService.GetVisibleMenuIdsAsync` 過濾可視選單。對於帳號相關表（`Accounts`、`PersonalSettings`、`Map_Account_*`），後端 `GetInitialDataAsync(empId)` 一律執行 `.Where(EmpId == empId)` 點查，僅回傳登入者自身的資料列。**禁止移除自身的資料列**（前端還原登入狀態與覆寫需要）。

---

## 🚨 2. 關鍵開發規範與常見陷阱 (Critical Pitfalls & Conventions)

**進行 C#、MSSQL 與前端開發時，必須遵守以下必守規則與防禦指南：**

### C# 後端與 MSSQL 開發規範
1. **工號取得**：一律從 `User.FindFirst(ClaimTypes.NameIdentifier)?.Value` 取得當前 `EmpId`。**嚴禁使用 `User.Identity.Name`**（該欄位為人員姓名，用於比對會導致權限判定與委派全數失效）。
2. **SQL 參數化**：所有原生 ADO.NET (`Microsoft.Data.SqlClient`) 或 SQL 查詢一律使用 `SqlParameter`（如 `@p`）。**嚴禁以字串拼接組裝 SQL 條件**。
3. **交易與執行策略**：因 DbContext 開啟 `EnableRetryOnFailure`，所有「先刪舊 mapping、再寫新 mapping」之多步原子操作，一律透過 `_context.Database.CreateExecutionStrategy().ExecuteAsync(...)` 包裝並顯式開啟 `BeginTransactionAsync()`。
4. **複合 PK 關聯表的兩回合 SaveChanges 規範**：對 `Map_Role_Menu`、`Map_Fab_Role`、`PersonalSettings` 替換關聯時，必須先 `RemoveRange(oldItems)` 並 `await _context.SaveChangesAsync()` 自 ChangeTracker 移除舊列後，才能 `Add(newItems)` 並再次 `SaveChangesAsync()`。同批 Add 前需使用 `HashSet` 或 `.Distinct()` 去重，否則會觸發 EF `Identity Map` 主鍵追蹤衝突。
5. **參照預檢 (`ValidateMappingRefsAsync`)**：寫入 `Map_*` 表前，先檢驗 `RoleId`、`MenuId` 是否存在於主表，回傳乾淨的 400 錯誤而非 500 FK Violation。
6. **實體索引集中宣告**：所有資料庫實體索引一律在 `SchemaBootstrap.EnsureIndexesAsync` 以 T-SQL 建立（例如 `IX_Accounts_Search (Name, Department)`），**嚴禁使用 EF Core `HasIndex`**（對既有資料庫為無效 metadata）。
7. **單語句 UPDATE + OUTPUT**：更新計數/時間等情境，一律寫為單一 SQL 並搭配 `OUTPUT INSERTED.*` 取得最新值（如 `UPDATE Accounts ... OUTPUT INSERTED.LoginCount WHERE EmpId=@EmpId`），禁用 UPDATE + SELECT 兩次來回。
8. **快取作廢與 ETag 推進 (`InvalidateInitialDataCache`)**：異動 `Menus`、`Roles`、`Fabs` 或 `Map_*` 表完成後，必須手動呼叫 `IInitialDataCacheInvalidator.InvalidateInitialDataCache()`。此舉不僅清除記憶體快取，更能推進 ETag 作廢 `visibleMenus:{ETag}:{empId}` 跨請求快取。`CacheInvalidationInterceptor` 可作為 EF SaveChanges 安全網，但原生 SQL/ADO.NET 仍須手動呼叫。
9. **約束啟用安全語法**：重新啟用約束時必用 `WITH CHECK CHECK CONSTRAINT ALL`，**嚴禁使用 `WITH NOCHECK CHECK`**。
10. **大批量寫入禁用 `SqlBulkCopy`**：維持參數化批次 `INSERT ... VALUES` 即可。因主機記憶體 (`6GB`) 有限，`SqlBulkCopy` 申請 Memory Grant 會在並發壓力下卡死於 `RESOURCE_SEMAPHORE`。
11. **DbContext 池化規範 (`AddDbContextPool`)**：建構子限接受 `DbContextOptions<AppDbContext>`，**嚴禁注入 Scoped 服務、嚴禁定義可變實例欄位、嚴禁於實例中修改逾時或追蹤設定**。
12. **查詢拆分 (`AsSplitQuery`)**：LINQ 查詢內含有 **2 個或以上 Collection `Include`** 時，必須於查詢結尾呼叫 `.AsSplitQuery()`，防止 Cartesian 乘積。
13. **唯讀查詢追蹤 (`AsNoTracking`)**：僅用於 JSON 序列化回傳且無須修改的 GET 查詢皆須 `.AsNoTracking()`；即將執行修改存檔 (`SaveChanges`) 的查詢嚴禁加入 `.AsNoTracking()`。
14. **狀態碼與日誌**：找不到資源回 `404 NotFound`，業務檢驗阻擋回 `400 BadRequest`。系統錯誤一律透過 DI 注入之 `ILogger<T>` 記錄，**嚴禁 `Console.WriteLine` / `Console.Error.WriteLine`**。
15. **時間與跨時區一致性 (`GETDATE()`)**：凡涉及每日造訪統計或跨日比對的查詢（如 `DailyUserVisits`），計算「今天」的基準必須以 SQL Server 資料庫端時間 (`CONVERT(date, GETDATE())`) 為準，防範 App Server 與 SQL Server 時區不一致導致的資料偏差。

### 前端 ES Modules 與安全規範
1. **CSRF Middleware 配置順序**：`Program.cs` 的 Antiforgery Middleware 必須置於 `UseAuthentication()` 與 `UseAuthorization()` **之後**，確保 Token 與正確的使用者 Identity 驗證綁定。
2. **CSP 與 SRI 標頭**：CSP 因前端 inline style/script 需求必須設定 `'unsafe-inline'`，並嚴格限制 CDN 白名單 (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `cdn.datatables.net`, `code.jquery.com`)。所有 CDN JS/CSS 載入標籤皆需配置正確的 `integrity` (SHA-384 Base64) 與 `crossorigin="anonymous"`。
3. **JS 跳脫 (`_jsArg`)、HTML 轉義 (`escHtml`) 與 URL 編碼 (`encodeURIComponent`)**：
   - 傳入 HTML inline `onclick="func('ID')"` 的變數，皆需先調用 `_jsArg()` 轉義，否則 Windows 網域 ID 內的 `\` 會被 JS 吞掉（如 `SARIEL\yu-ting` -> `SARIELyu-ting`）。
   - 將資料庫回傳的使用者資料（如 `empName`, `department`, `err.message` 等）動態拼接入 `innerHTML` 時，必須調用 `escHtml(s)` 實體跳脫，防範 Stored / Reflected XSS。
   - 透過 REST API (`GET /api/Accounts/{id}`) 傳送 ID 時，URL 路徑參數必須包裝 `encodeURIComponent(id)`。
4. **帳號查詢上限限制**：後端 `AccountsController.GetAccountsPaged` 對於參數 `q` (`Contains` 查詢)，在 DB 執行前必定截斷長度至 100 字(`term.Substring(0, 100)`)；同理 `ActivityLogger.QueryAsync` 的 `keyword` 截斷至 500 字，避免超長輸入導致 `nvarchar` 字串截斷錯誤 (`SqlException 8152`)。
5. **Root 最上層選單判定**：檢查節點是否為最上層，必須同時驗證 `(!cleanId(m.parentId)) && (m.parentIds||[]).filter(Boolean).length===0`。
6. **樹狀編輯器變數宣告**：`Tree Builder` 的 `innerHTML` 模板字面值若引用 `${xxxHtml}`，必須在模板上方預先以 `const` 宣告，避免拋出 `ReferenceError`。
7. **App Shell 與 LocalStorage 快取防禦 (`clearAppCache`)**：因 `index.html` 內嵌腳本會在 JS 載入前第一時間從 `localStorage` (`app_shell_top_menus`, `app_shell_sidebar_menus`) 填入舊版面快照，且 `Ctrl+F5` 不會清除 `localStorage`。當執行 `syncDataToDB()`、後台 CRUD RESTful 存檔 (`save*API`/`delete*API`)、登入切換身分或登出時，必須自動呼叫 `window.clearAppCache(preserveCurrentUser)` 清理過時的 `app_shell_*` 與 `umc_personal_menus_*` 快取，確保畫面與 DB 最新狀態隨時保持百分之百同步。
8. **回饋訊息分流 (`showToast` vs `customAlert`)**：「成功/資訊」類回饋一律走 `ui/dialogs.js` 的非阻斷式 `showToast(msg, type, delay, isHtml)`（右上角 Bootstrap Toast、自動消失）；錯誤與需使用者決策的情境才走 `customAlert` / `customConfirm`。舊有「匯入結果訊息抑制補丁」(`__allowImportResultAlert`) 已隨此機制移除，勿再引用。
9. **JS 版本碼 (`?v=`) 全站一致性**：`index.html` 的 `<script src>` 與所有模組內部 `import ?v=` 版本碼必須完全一致（目前 `20260719c`），否則同一模組會以不同 query 被重複實例化兩份導致狀態分裂。改版時全域取代，勿只改單檔。
10. **i18n 全量覆蓋**：新 UI 文字必掛 `data-i18n`（placeholder 用 `data-i18n-placeholder`）並在 `config.js` 同步補 zh/en/ja 三語 key；JS 動態字串走 `t(key, fallback)`，帶數值訊息用 `{0}` 模板 + `.replace()`。含圖示元素須把文字包 `<span data-i18n>` 以免替換 innerHTML 時吃掉圖示。
11. **RWD 斷點集中管理**：`@media` 覆寫一律寫在 `css/responsive.css`（≤992px 側欄浮層+遮罩 / ≤768px 手機 / ≤480px 窄幅）；JS 行為集中在 `ui/layout.js` RWD 區塊，斷點常數 992 兩邊必須一致。
12. **帳號即時同步與防呆 (`restoreLoginFromStorage` / `MyProfile`)**：後端 `/api/Auth/MyProfile`、`WhoAmI`、`Config` 端點皆加入 `Cache-Control: no-cache, no-store, must-revalidate` 標頭且前端以 `{ cache: 'no-store' }` 請求，防止身分與授權回應被瀏覽器快取。當使用者按 `Ctrl+F5` 重整時，`restoreLoginFromStorage` 會比對 `window._currentServerEmpId` 進行雙重身分驗證（不符則靜默清 localStorage 重走自動偵測），並透過 `Object.assign` 將 DB 最新的帳號欄位（名稱、部門、個別選單覆寫與角色）即時同步寫回 local user，確保無需手動清除快取即可反映最新權限。

---

## 🛠️ 3. 目前進行中與待辦事項 (Active & Open Tasks)

- [x] **Ctrl+F5 強制重整無法更新快取問題修復 (`LocalStorage Cache Defense & Identity Guard`)**：(1) 後端 `AuthController` 的 `/api/Auth/Config`、`WhoAmI` 與 `MyProfile` 全面加上 `Cache-Control: no-cache, no-store, must-revalidate` HTTP 標頭，且前端 `fetch` 請求一律帶上 `{ cache: 'no-store' }` 防止瀏覽器快取；(2) 擴充 `MyProfile` API 回傳帳號名稱 (`name`)、部門 (`department`) 與登入統計數值；(3) 前端在 `fetchInitialDataFromDB` 中將 API 回報之真實身分記錄於 `window._currentServerEmpId` 與 `_currentServerProfile`；(4) `main.js` `restoreLoginFromStorage` 增加雙重身分驗證，並以 `Object.assign` 將最新 DB 資料完整同步至 `localStorage`，保證按 `Ctrl+F5` 隨時自動更新至最新的帳號與權限。
- [x] **P0~P2 關鍵安全與測試防線修復 (`Security & Test Hardening`)**：(1) `Program.cs` 增設 `Auth:SimulatedAccount` 正式部署防線且 `appsettings.json` 預設留空；(2) 整合測試 `EqDashboardWebAppFactory` 明確注入 `AllowManualLogin=true` 與 `OpenAccessMode=false` 測試設定，8/8 測試全數通過；(3) `openMenuSelector` 首頁挑選器全面套用 `escHtml` 與 `_jsArg` 防禦 Stored XSS；(4) `main.js` 初始例外轉義 `error.message` 且 `error.stack` 僅限開發環境顯示。
- [x] **全站系統架構與安全效能全面健檢 (`Audit Fixes`)**：已完成所有 1 個 Critical (`EnsureDailyUserVisitsAsync` 自助補表修復)、4 個 High (`AnalyticsController` 連線池安全、補 `ILogger`+`try-catch`、`traffic-stats.js` XSS `escHtml` 防禦)、4 個 Medium (時區對齊、部門模糊查詢、防 NULL、`SqlParameter` 替代 `AddWithValue`) 修正並驗證通過。
- [~] **本地 Git 版控收尾**：確認 `bin/`, `obj/`, `.vs/`, `App_Data/`, `appsettings.json` 不進版控並完成 commit，維持工作目錄乾淨。
- [ ] **DataProtection 金鑰輪換 (安全優先)**：刪除歷史外洩之 `App_Data/keys/*` 檔案，由系統自動重產新金鑰。
- [ ] **大型規模擴展評估 (長期可選)**：針對未來選單/看板超過數千筆情境，規劃 Category/Tags 搜尋架構、樹狀選單 Lazy Rendering 及分廠載入。

---

## 🔄 4. 雙 AI 協同與文件同步規範

本專案由使用者同時協同 Gemini 與 Claude 進行開發。每次回答或修改完成前，**必須自動執行**：
1. **同步 `CLAUDE.md` 與 `memory.md`**：將新確定之開發規範或坑點寫入，移除已過時之歷史任務。
2. **同步 `專案架構.md`**：若新增、修改或移除檔案/目錄與職責，同步更新專案架構說明。
3. **資料庫架構變動與 SQL 腳本同步 (`DB_Table.md` & `.sql` - 嚴格執行)**：
   - 由於遠端正式/測試資料庫已存在且運行中，若改動涉及任何 DB 架構（新增表/欄位/索引等）：
     1. 修改 `DB_Table.md` 資料表定義快照。
     2. **於專案目錄下產出一份增量異動 SQL 腳本檔案 (`.sql`)**（使用 `IF NOT EXISTS` 冪等 DDL 相容既有資料）。
     3. **於 `DB_Table.md` 結尾「5. 架構異動與增量 SQL 紀錄 (Schema Changelog)」追加當天日期 (`YYYY-MM-DD`) 與該 `.sql` 檔名紀錄**。
4. **回覆標明**：於答覆末尾附上 `*已自動更新 CLAUDE.md 與 memory.md*`（若產出 SQL 檔或異動架構亦同步標明）。
