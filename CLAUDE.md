# EQ Performance Dashboard - 專案說明文件 (CLAUDE.md)

> 本文件提供 AI 助手在此專案下開發、修改、除錯所需的最小必要知識（現況快照，非歷史日誌）。
> **兩個專案版本：**
> - **EQDashboard**（原版）：單一專案，JS/CSS 為單檔。
> - **EQDashboard.V2.Web**（重構版，**目前主線**）：相同功能，後端拆 Service 層 + DI、前端 ES Modules 模組化、Modal 抽離。
> **兩版版面與功能 100% 一致，V2 僅改善可維護性。** 現役方案 `EQDashboard.V2.Web.sln` 含 Web 專案＋巢狀最小整合測試專案 `EQDashboard.V2.Web.Tests`（xUnit + `WebApplicationFactory<Program>`，鎖住 authz/CSRF/可見性矩陣），build 0 警告 0 錯誤、`dotnet test` 全綠。

---

## 1. 專案定位與運行模式

| 項目 | 舊版 (參考網頁) | 新版 (本專案 V2) |
| --- | --- | --- |
| 啟動方式 | 瀏覽器開 `TEST_20260429.html` | 啟動 ASP.NET Core Kestrel/IIS |
| 資料來源 | 讀 `EQDashboard_Setting.xlsx` | 呼叫 `/Settings/GetInitialData` 讀 MSSQL |
| 資料保存 | 匯出 `.xlsx` | **CRUD 異動自動靜默寫回 MSSQL**（無「同步至 DB」按鈕） |
| 個人化設定 | LocalStorage | DB (`PersonalSettings` 表) + LocalStorage 快取 |
| 登入統計 | LocalStorage | DB (`Accounts.LoginCount`/`LastLoginTime`)，登入呼叫 `/Settings/UpdateLoginStats` |
| 預設 URL | 本機檔案 | V1: `http://localhost:5242` / V2: `http://localhost:5000`、`5242` |
| 資料庫 | — | V1: `EQDashboard` / V2: `EQDashboardV2`（Server `Sariel`, User `testuser`）|

身份驗證：**雙模式** — Kestrel + Negotiate 自動偵測 Windows 桌機帳號；AD LDAP 手動帳密（登入框 2 個 tab）。登出設 `umc_force_manual_login` 旗標避免 Windows Auth 立刻又拉回。離線開發用 `appsettings.json` 的 `Auth.TestAccounts`（正式環境須關閉）。**`Auth:AllowManualLogin=false` 可整個停用手動帳密**：前端 `auth.js applyAuthConfigToUI` 藏掉手動 tab、後端 `AuthController.Login` 擋掉手動端點、`auth.js:79` 的 logout 強制旗標也因 `&& config.allowManualLogin` 自動失效。**關鍵 gotcha**：`showLoginOverlay(defaultTab)` 必須 config-aware —— `logout()` 硬編碼傳 `'manual'`，若不在 `showLoginOverlay` 內把 `'manual'`→`'windows'` 強制改回（且每次都重套 `applyAuthConfigToUI`），停用手動後「登出」會切到被隱藏的手動 tab、卻仍露出其帳號/密碼輸入面板（Bootstrap `Tab.show()` 會啟用 pane 即使 nav 按鈕 `display:none`）。注意 **TestAccounts 走手動端點驗證，故 `AllowManualLogin=false` 也會一併擋掉測試帳號登入**。**第二個 gotcha（與第一個相依）**：`logout()` 會 `sessionStorage.setItem('umc_force_manual_login','1')`，但此旗標**只在 `tryAutoLogin` 的 `if (forceManual && config.allowManualLogin)` 分支被清除**。`AllowManualLogin=false` 時該分支被跳過 → 旗標永久殘留 → `fetchWhoAmI(true)` 的自動登入閘門（要求 `FORCE_MANUAL_KEY !== '1'`）永遠被擋 → **每次進站都卡在 Windows 偵測畫面要手動點「以此身份進入」**。修法：`tryAutoLogin` 在讀 `forceManual` 前若 `!config.allowManualLogin` 就先 `sessionStorage.removeItem(FORCE_MANUAL_KEY)`（純自動模式下旗標無意義）→ 自動偵測成功（帳號有權限）即自動登入；唯帳號無權限時 WhoAmI 回 `success:false`、`currentUser` 不設 → `showLoginOverlay('windows')` 才停在偵測畫面。**改動此旗標生命週期務必同時檢視 logout/tryAutoLogin/fetchWhoAmI 三處**。

---

## 2. 檔案結構 (File Structure)

### 2.1 EQDashboard.V2.Web（主線，模組化）

```
C:\EQDashboard\EQDashboard\EQDashboard.V2.Web\
├── EQDashboard.V2.Web.sln              # 含 Web 專案 + EQDashboard.V2.Web.Tests
├── EQDashboard.V2.Web.csproj           # ⚠️ 預設 glob 排除 EQDashboard.V2.Web.Tests\** 避免雙重編譯
├── EQDashboard.V2.Web.Tests\           # 巢狀最小整合測試（xUnit + WebApplicationFactory<Program>）：AuthzMatrixTests.cs
├── Program.cs                          # DI 註冊 + middleware pipeline + 健康檢查端點（檔尾 public partial class Program 供測試 host 抓組態）
├── appsettings.json                    # ConnectionStrings:EQDashboard（值的 Initial Catalog=EQDashboardV2）
│   appsettings.json.example            # 範本（appsettings.json 已不進版控）
├── Models\                             # 每個 Entity 獨立檔案 + DTOs\ + Settings\(AuthSettings)
├── Data\
│   ├── AppDbContext.cs                # 用 ApplyConfigurationsFromAssembly
│   └── Configurations\                # 每個 Entity 一個 IEntityTypeConfiguration
├── Services\                           # Service 層 + Interfaces\
│   ├── SettingsService / AccountService / AuthService / MenuAuthService / IconStorageService / MenuService(由 MenusController 抽出)
│   ├── InitialDataCacheInvalidator(Singleton 集中清快取+bump ETag) + CacheInvalidationInterceptor(EF SaveChangesInterceptor 安全網)
│   ├── SchemaBootstrap.cs            # 啟動時 idempotent 補表/補欄位/補索引（無 EF Migrations）
│   ├── ActivityLogger / ActivityLogQueue(滿載告警不丟最舊) / ActivityLogProcessor(BackgroundService，批次 drain 單次 SaveChanges) / ActivityLogPurgeService(BackgroundService，每日刪 ActivityLog:RetentionDays 天前稽核，<=0 停用)
│   └── Helpers\ClientIpHelper.cs
├── Controllers\                        # 薄 Controller：Settings / Accounts / Menus / Roles / Fabs / Apps / Auth / ActivityLogs / PersonalSettings
└── wwwroot\
    ├── index.html                      # 唯一進入點 <script type="module" src="js/main.js">
    ├── partials\modals.html            # 10 個 Bootstrap Modal，由 fetch 動態載入
    ├── css\  variables / navbar / sidebar / components
    └── js\
        ├── store.js (狀態中心) / config.js (i18n) / api.js (DB 讀寫) / auth.js / main.js (進入點)
        ├── ui\        layout / navigation / dialogs
        ├── render\    sidebar / sidebar-item / tables / account-ui
        └── admin\     modal-utils / fab-manage / role-manage / account-manage / menu-manage / misc-manage
```

### 2.2 前端 ES Modules（重要）

- `index.html` 只載入 `<script type="module" src="js/main.js?v=...">`，由 main.js `import` 整張模組圖。
- **所有 `import` 必須置於檔案最上方**（header 註解後、第一個宣告前）。切勿塞進函式內 —— 任一模組 SyntaxError 會中止整張圖（畫面卡「載入中…」、登入/登出全失效）。
- 模組內 `function X` 為模組作用域；HTML inline `onclick="X()"` 需顯式 `window.X = X` 暴露。
- 新增模組可用 `node --check`（複製成 `.mjs`）離線驗證語法。
- `partials/modals.html` 由 `fetch(...)` 動態載入，在 JS 初始化前完成。

---

## 3. 技術版本 (Tech Stack)

### 3.1 後端
| 項目 | 版本 / 說明 |
| --- | --- |
| .NET SDK | **.NET 9.0**；Nullable `enable`、ImplicitUsings `enable` |
| Web | ASP.NET Core MVC + Static Files |
| 資料存取 | EF Core 9 + raw ADO.NET（`Microsoft.Data.SqlClient` 7.0.1）|
| Swagger | `Swashbuckle.AspNetCore` 7.2.0（僅 Development 啟用）|
| DB | **MSSQL**（Server `Sariel`, V1 `EQDashboard` / V2 `EQDashboardV2`, User `testuser`）|
| 連線字串 | key 皆 `ConnectionStrings:EQDashboard`（Program.cs 讀 `GetConnectionString("EQDashboard")`）；差異在 value 的 Initial Catalog。可用環境變數 `ConnectionStrings__EQDashboard` 覆寫 |

### 3.2 前端（全走 CDN，無 npm/bundler）
Bootstrap 5.3.2、jQuery 3.7.0、DataTables 1.13.6、Font Awesome 6.4.0、SheetJS(xlsx) 0.18.5（設定檔匯入/匯出 Excel 用）。

### 3.3 啟動 Profile
http `5242` / https `7033;5242` / IIS Express `45686`、SSL `44356`。

---

## 4. 資料模型 (Database Schema)

完整建表 SQL：`參考網頁/MSSQL_DB架構.sql`。**本專案無 EF Migrations** — schema 由 `SchemaBootstrap` 啟動時以 idempotent raw SQL 自我修復（補欄位/補表/補索引），其餘靠 `sql/` 腳本手動管理。

**實體表（7）**：`Menus`、`Fabs`、`Roles`、`Accounts`（含 RoleLevel / CanEditOthers / LoginCount / LastLoginTime）、`Apps`（Base64 圖示）、`Requests`、`PersonalSettings`（複合 PK EmpId+MenuId）。
**關聯表（10）**：`Map_Fab_Role`、`Map_Account_Role`、`Map_Account_ManageMenu`（委派）、`Map_Role_Menu`（含 SortOrder）、`Map_Menu_Structure`（父子，Restrict FK）、`Map_Account_DefaultPage`、`Map_Account_ExtraMenu`、`Map_Account_DenyMenu`、`Map_Menu_AllowAccount`、`Map_Menu_DenyAccount`（後四張 ACL/override 表由 SchemaBootstrap 自動建立）。**`Map_Account_ExtraMenu`/`Map_Account_DenyMenu` 為 per-fab（綁廠區）**：PK=`(EmpId, FabId, MenuId)`，`FabId`＝「此額外開放/封鎖只在哪個廠區生效」（key＝廠區名，同 `Map_Account_DefaultPage` 慣例）。**FabId 刻意不加 FK 到 Fabs**（避免 Account/Menu/Fab 多重 cascade 路徑衝突＋讓舊資料遷移列 `FabId=''` 存活）；FK 仍只在 EmpId→Accounts(CASCADE)、MenuId→Menus。`SchemaBootstrap.EnsureOverrideTableAsync` 對既有表補 `FabId` 欄位＋drop 舊 PK＋重建複合 PK（idempotent）。
**稽核**：`UserActivityLogs`（操作紀錄，SchemaBootstrap 建表 + 效能索引）。

**前端 ↔ DB 欄位對應**：前端 camelCase（`m.id`/`m.displayName`）、DB PascalCase（`MenuId`/`DisplayName`）。轉換集中在 `api.js`：讀取 `getVal(obj,key)` 無視大小寫；寫入 `getDatabasePayload()` 顯式 PascalCase。**Accounts 的 LoginCount/LastLoginTime 必須帶上 payload**，否則全表覆寫會洗成 NULL。

**圖示儲存（Menu.Icon / App.IconBase64）**：一律「**base64 → 實體檔，DB 只存路徑 `/images/icons/{guid}.{ext}`**」。統一走 `IIconStorageService`（`Services/IconStorageService.cs`）：`SaveAsync` 把 data: URI 依 **MIME 白名單**（png/jpg/jpeg/gif/webp/svg/bmp/ico）寫檔、把自我參照的絕對 URL 正規化成相對路徑、FA class（如 `fas fa-folder`）與外部 URL 原樣保留、非白名單 data: 一律丟棄；`DeleteIfLocalUnreferencedAsync` 在 update/delete 後做「參照檢查 + path-traversal 防護」的孤兒清理；`MigrateBase64IconsAsync` 在啟動時一次性把 DB 既有 base64 轉檔（idempotent）。欄位名雖仍叫 `IconBase64`（相容舊資料），實際內容已是路徑字串。

---

## 5. API 規範

- **Legacy（全量）**：`GET /Settings/GetInitialData`（一次取全部表，非 admin 後端按可見性過濾）、`POST /Settings/SaveData`（全量覆寫，DELETE→INSERT 包 Transaction）、`POST /Settings/UpdateLoginStats`。**GetInitialData 的 ETag 必須摻入身分（`"{全域ETag}:{empId}:{isAdmin}"`），不可退回只用全域版本號**：回應 body 對非 admin 做列級過濾＝同一 URL 不同使用者內容不同；全域 ETag 會讓共用瀏覽器 profile 的機台換帳號後拿 304 → 瀏覽器回放「前一位使用者」的快取 body（admin 全量資料外洩給非 admin、或反向拿到殘缺資料）。304 路徑也須帶 `ETag` 標頭（HTTP 規範）。
  - **GetInitialData 的「帳號相關表」現在連 admin 也只回自身列（2026-06-14 重構）**：`SettingsController` 對 admin 回應前，把 `Accounts` / `PersonalSettings` / `Map_Account_*`（透過 `IsOwnAccountScopedTable`）以 `RowMatchesEmpId` 過濾成「只剩呼叫者自己這列」（非 admin 本就已列級過濾，行為不變）。**目的**：把「全部帳號＋全部 Map_Account_* mapping」徹底移出 GetInitialData 熱路徑（10 萬帳號時 admin 端記憶體/序列化爆量的根因），帳號清單改走下方 server-side 分頁端點。**但呼叫者「自己那列」絕不可移除** —— `main.js restoreLoginFromStorage` 以「appState.accounts 內找不到自己」判定為帳號被刪→強制重登；`api.js` 也靠 `MyProfile` 覆寫自身列。**`Requests` 與 `Map_Menu_Allow/DenyAccount` 刻意不對 admin 收斂**（admin 需全量管理待辦申請、需全帳號清單編輯 menu ACL）。
  - **（P1，2026-06-16）帳號相關表已從「共享快取整包載入＋Controller 過濾」改為 service 端 per-caller 點查**：`ISettingsService.GetInitialDataAsync(string empId)` 現在收呼叫者工號；`Accounts` / `PersonalSettings` / 5 張 `Map_Account_*` 以 `.Where(x => x.EmpId == empId)` 點查（`EmpId` 為各表 PK 前導欄＝index seek、不全表掃描），**不進共享快取**。共享快取（`InitialData_Volatile`，10s）因此只剩 `Requests`；`InitialData_Global`（60s，9 張不隨帳號數成長的全域表）不變。**動機**：徹底解 §8 P1 剩餘項 —— 原本這些「隨帳號數成長」的表整包常駐 6GB Sariel，10 萬帳號時記憶體脹爆。**行為不變保證**：回應對 admin/非 admin 仍「只含自己這列」，與舊「Controller 收斂後」逐位元相同（Controller 的 `adminScoped` 收斂與非 admin `FilterTable` 對這些表變成 no-op，**刻意保留作防禦縱深**、且全域表的真正過濾仍需 `FilterTable`）；`dbData.Count` 仍須 == 17（9 global + 1 Requests + 7 per-caller），否則丟例外。**always-fresh（無 10s 過時窗）**：個人版面/登入計數更新後仍靠 `InvalidateVolatile()` 的 ETag bump 觸發客戶端重抓（不可移除那些 `Invalidate*` 呼叫——ETag bump 同時作廢 `visibleMenus:{ETag}:{empId}` 快取）。**新增任何「隨帳號數成長」的帳號相關表時，沿用 per-caller 點查、勿放回共享快取**。
- **RESTful（主線，逐步取代全量覆寫）**：`Fabs` / `Roles` / `Accounts` / `Menus` Controller 的 POST/PUT/DELETE。每個寫入端點完成後必呼叫 `InvalidateInitialDataCache()` 同步 10s 讀取快取。
- **帳號清單／匯出（2026-06-14 重構，搭配上面 GetInitialData 去全表化）**：
  - `GET /api/Accounts?page=&pageSize=&q=`（admin-only）：server-side 分頁，`q` 以 EmpId/Name/Department `Contains` 比對、`Skip/Take` 直接下推 DB（pageSize 上限 100）。**`q` 比對前必 cap 長度（`if(term.Length>100) term=term.Substring(0,100)`）**：`Contains` 翻成 `LIKE '%'+@p+'%'`、`@p` 為 `nvarchar(4000)`，超長 term 會溢出 → SqlException 8152「字串會被截斷」500；被比對欄位最長 Name/Department=nvarchar(100)，截在 100 字零功能損失。**只回每列基本顯示資料**（empId/name/department/roleLevel + assignedRoles + defaultPages），不含 manageableMenus/extra/deny 明細。回應形狀 `{items,total,page,pageSize}`。前端「帳號管理」表（`render/tables.js renderAccountTable`）為 `serverSide:true` DataTable，自訂 `ajax` 函式換算 page/pageSize/q→打此端點，故帳號數成長到數萬也只傳單頁。
  - `GET /api/Accounts/{id}`（admin-only）：單帳號完整明細 lazy-load（含 manageableMenus/extraMenus/denyMenus），**編輯帳號時必先打此端點取 acc**（`admin/account-manage.js editAccount` 已不再依賴 `getAccounts()`，因清單只剩自己一列）。**呼叫時 `{id}` 必 `encodeURIComponent`（GET/PUT/DELETE 皆然）**：Windows 網域工號含反斜線（`SARIEL\yu-tinglin`），未編碼時瀏覽器把 URL 路徑中的「`\`」正規化成「`/`」→ `/api/Accounts/SARIEL/yu-tinglin` 變兩段路徑 → 路由不匹配 **404** → editAccount 拿不到明細（模態空白／用殘缺資料）、後續儲存連帶失敗。編碼後 `%5C` Kestrel 接受、路由綁回單一 `id="SARIEL\yu-tinglin"` → 200。`saveAccountAPI`/`deleteAccountAPI`/`editAccount` 三處皆已 `encodeURIComponent`；**2026-07-03 起 `api.js` 的 Menu/Role/Fab/App save/delete URL id 亦一律 `encodeURIComponent`**（這些 id 為系統產生、URL-safe，編碼為 no-op，補上純為防禦模式一致——新增 RESTful 呼叫一律照此模式）。此為與 §6.4 `_jsArg`（inline onclick 反斜線）並列的「反斜線工號」第二類陷阱（URL path 正規化）。
  - `GET /api/Accounts/export`（admin-only，⚠️ 路由 literal `export` 在 ASP.NET 優先序高於 `{id}`）：一次性回全部帳號完整明細（含 assignedRoles/manageableMenus/defaultPages），供 Excel 匯出備份。`admin/misc-manage.js createWorkbookData` 已改 **async**、改打此端點（`exportConfig` 須 `await`），不再從 `getAccounts()` 組 sheet。
  - **工號唯一性改由後端 `CreateAccountAsync` 把關**（回 400「帳號工號已存在」）；前端 `saveAccountItem` 已移除依賴 `getAccounts().some()` 的本地查重（清單只剩自己一列、無法本地查重）。
- **`GET /api/Auth/MyProfile`（登入者自身權限的 lazy-load，自足來源）**：回 `empId` / `roleLevel` / `canEditOthers` / `assignedRoles` / `manageableMenus` / `extraMenus`(per-fab `{廠區:[menuId]}`) / `denyMenus`(per-fab) / `defaultPages`。皆為**自己的值、無資訊外洩**。前端 `api.js` 取此覆寫 `appState.accounts` 自身列的對應欄位（`canEditOthers` 僅在 `typeof === 'boolean'` 時覆寫、向後相容）。**delegated-admin UI 判定（`canEditOthers`）以此為準，勿再退回只靠 `GetInitialData` 自身列或 Login 回應**（曾為兩個隱性來源、脆弱）。**MyProfile 與 `GetInitialData` 在 `fetchInitialDataFromDB` 內並行發出**（兩者互不相依、皆僅需 auth cookie）：MyProfile 的 `fetch` promise 在函式頂部就 fire（與 `GetInitialData` 同時送出），待 `appState.accounts` 組裝完成後才 `await` 該 promise 做自身列覆寫——每次登入/刷新省 1 個 RTT。**勿改回序列 `await`**（會把這 1 個來回又疊回登入關鍵路徑）；覆寫邏輯與 `myEmpId`（取自 `myProfile.empId`，供 localStorage 個人版面快取 key）須維持在 `await` 之後。**並行的必然結果：未登入/cookie 過期的冷開頁時 MyProfile 與 GetInitialData 都會 401，故 `api.js` 全域 fetch 攔截器的 401 排除清單必含 `/api/Auth/MyProfile`（連同 `/api/Auth/Login`、`/Settings/GetInitialData`、`/api/Auth/WhoAmI` 共四個）**——漏排除會在每次冷開頁觸發 `logout()`（連發 Logout 請求＋設 `umc_force_manual_login` 旗標卡住 Windows 自動登入）＋彈「登入時效已過期」擾民視窗（2026-07-03 修正）。MyProfile 的 401 由呼叫端 `if (myProfileRes.ok)` 靜默處理。
- 健康檢查：`GET /health`（liveness、不碰 DB、可公開）、`GET /health/ready`（readiness、含 DB 檢查、僅 loopback/私有網段、其餘 404）。

---

## 6. 開發規範 (Development Conventions) — 必守

### 6.1 通用
- **畫面一致性優先**：UI/互動改動須對照 `參考網頁/TEST_20260429.html`。
- **不破壞 `appState` 結構**（`menus/fabs/roles/accounts/apps/requests`），新增欄位用擴充。
- **禁止引入 build pipeline**（webpack/vite/TypeScript/npm）；前端維持 jQuery + Vanilla + Bootstrap CDN。

### 6.2 後端 (C#)
- Controller 命名 `XxxController : Controller`，保持薄。
- **SQL 安全**：使用者輸入一律走 `SqlParameter`，**禁止字串拼接 SQL 值**。（DDL 內硬編碼的常數表名/欄位例外，可接受。）
- 寫入類一律包 `BeginTransaction()`。**「刪舊 mappings→寫新 mappings」式的多步寫入必須整批原子**（同 `AccountService.UpdateAccountAsync`、`MenusController.BatchUpdateMenus`、`RolesController.UpdateRole`、`FabsController.UpdateFab`、`PersonalSettingsController.SavePersonalSettings`）：無交易時第二段失敗會留下被清空的關聯。**且 DbContext 已啟用 `EnableRetryOnFailure` → 手動交易一律透過 `_context.Database.CreateExecutionStrategy().ExecuteAsync(...)` 包起來**（直接 `BeginTransactionAsync` 會拋 "The configured execution strategy ... does not support user-initiated transactions"）。
- **複合 PK 關聯表的「刪舊→寫新」必須先 `SaveChangesAsync()` 落實刪除、再 Add 新列（拆兩次 SaveChanges）**：`Map_Role_Menu`(RoleId+MenuId)、`Map_Fab_Role`、`PersonalSettings`(EmpId+MenuId) 等複合 PK 表，若在單次 SaveChanges 內 `RemoveRange` 既有（tracking 查詢）後又 `Add` 同鍵新列，EF identity map 會丟「another instance with the same key value is already being tracked」（reorder/隱藏切換因鍵不變必中）。先刪→SaveChanges→再寫＝跨兩次 SaveChanges，故須照上一條包進 ExecutionStrategy 交易。**另：Add 前對來源 id 去重**（`HashSet`），避免同一批 payload 內重複鍵撞「Added 同鍵」。樣板：`RolesController.UpdateRole`、`PersonalSettingsController.SavePersonalSettings`。
- **寫入 Map_* 關聯前先驗證參照 id 存在**（`Accounts`/`Roles`/`Fabs` controller/service 皆有此預檢，1.3）：stale `RoleId`/`MenuId` 撞 FK 會 500，先查出來回 400+明確訊息。`AccountService.ValidateMappingRefsAsync` 驗 AssignedRoles/ManageableMenus/DefaultPages/Extra/Deny 的 role/menu id（DefaultPage 的 FabId FK 不另驗、交給交易保護）。
- **Schema/索引**：可自動補的欄位用 `IF COL_LENGTH(...) IS NULL ALTER TABLE`。**所有實體索引集中於 `SchemaBootstrap.EnsureIndexesAsync`（idempotent `IF NOT EXISTS(sys.indexes) CREATE INDEX`）；勿用 EF `HasIndex`** —— 無 Migrations 時它對既有 DB 是 no-op、純 metadata 會誤導。**帳號搜尋走窄覆蓋索引 `IX_Accounts_Search (Name, Department)`（P2）**：`AccountService.GetAccountsPagedAsync` 的 `q` 對 EmpId/Name/Department 做子字串 `Contains`→`LIKE '%term%'`（前置萬用字元、**本質 non-sargable、無法 seek、必掃描**）；此索引讓不可避免的掃描改讀瘦索引（葉層自動含 clustered key `EmpId` 作 row locator）而非整個寬 `Accounts` 表，`COUNT(*)` 的三欄 OR-of-LIKE 完全被涵蓋免回主表。**真正子線性需 full-text（過度設計、不在範圍）；改 `StartsWith` 前綴才能 seek 但會改變子字串搜尋語意——勿擅改 UX**。
- **「UPDATE 後再取回新值」一律合併為「單語句 + `OUTPUT INSERTED.*`」一次往返（P4），禁止 UPDATE 後再 SELECT（2 round trips）**：樣板 `SettingsService.UpdateLoginStatsAsync`——`UPDATE Accounts SET LoginCount = ISNULL(LoginCount,0)+1, LastLoginTime = GETDATE() OUTPUT ISNULL(INSERTED.LoginCount,0), INSERTED.LastLoginTime WHERE EmpId=@EmpId;` 後 `ExecuteReaderAsync`，**reader 無列 ⟹ WHERE 未命中 ⟹ 帳號不存在**（不需另一次 `@@ROWCOUNT`/SELECT）。OUTPUT 支援純量運算式（`ISNULL`）；`Accounts` 表無 trigger 故 OUTPUT（不帶 INTO）直接回 client。單語句天然原子，順帶消除「UPDATE 成功後、SELECT 前被其他並行登入再加一」而讀到非自己這次寫入值的窗。
- 寫入端點必呼叫 `InvalidateInitialDataCache()`（或 volatile 版）；`GetInitialDataAsync` 僅在**全部表載入成功**才 `_cache.Set`（避免快取殘缺資料 10s）。**此呼叫現在是雙重 load-bearing**：除了清 InitialData 快取，它還會 bump `_currentETag`，而 `MenuAuthService.GetVisibleMenuIdsAsync` 的可見集合跨請求快取（key=`visibleMenus:{ETag}:{empId}`）正是靠 ETag 變更來自動作廢。**新增任何會動到權限相關表（Map_Role_Menu / Map_Account_* / Map_Menu_Allow/DenyAccount / Map_Menu_Structure / Menus）的寫入路徑時，務必呼叫 `Invalidate*DataCache()`**，否則使用者會在 60s TTL 內讀到過期可見集合（權限變更不生效）。**清快取/bump ETag 的職責已集中到 `InitialDataCacheInvalidator`（Singleton），各 Controller/Service 注入 `IInitialDataCacheInvalidator` 呼叫；另有 `CacheInvalidationInterceptor`（EF `SaveChangesInterceptor`）作為安全網 —— 任何經 `SaveChangesAsync` 動到上述實體表者即自動觸發作廢，避免日後新增寫入路徑漏呼叫。但 raw ADO.NET 寫入（不走 EF tracking）不會被 interceptor 攔到，仍須手動呼叫。**
- **FK 重新啟用一律用 `WITH CHECK CHECK CONSTRAINT ALL`（重新驗證、constraint 變 trusted），禁止 `WITH NOCHECK CHECK`**（後者既有列不重驗→untrusted→可能殘留孤兒資料且 optimizer 不信任）。`SaveDataAsync` 在交易內重驗，失敗一律 `trans.Rollback()`＋回 `(false,…)`，**不可吞例外硬 commit**（寧可整批失敗也不寫進不完整資料）。
- **禁止**為「加速」把批次參數化 INSERT 改回 `SqlBulkCopy` —— Sariel 僅 6GB RAM，bulk load 需 workspace memory grant，在記憶體壓力下卡 `RESOURCE_SEMAPHORE`（曾達 196s）。
- **`AppDbContext` 走 `AddDbContextPool`（非 `AddDbContext`）以重用實例、降配置/GC 壓力（P3 優化，Program.cs）**。**維持可池化的硬性前提，改動 `AppDbContext` 時務必守住**：①建構子只能吃 `DbContextOptions<AppDbContext>`，**禁止**注入任何 scoped 服務（pool 無法 per-resolve 重新注入）；②**禁止**新增可變實例欄位/狀態（歸還 pool 時 EF 只重設 ChangeTracker，不會清你自訂的欄位 → 會跨請求洩漏）；③**禁止**在注入的 context 上做 per-instance 設定變動（`Database.SetCommandTimeout` / `ChangeTracker.*` / `QueryTrackingBehavior` 等，pooling 不重設這些）。`CacheInvalidationInterceptor` 必須維持 **Singleton**（依賴亦 Singleton）—— pool 一次性凍結 options，scoped 攔截器會在啟動即拋「Cannot resolve scoped from singleton」；其 `ConditionalWeakTable` 以 context 實例為 key，靠「每次 SaveChanges 內 Mark→Flush/Discard 成對完成、不跨請求殘留」對實例重用安全（勿改成跨 SaveChanges 持有 pending）。**驗證**：build 0/0、整合測試以真實 `AddDbContextPool` host 跑（factory 只換掉 Negotiate scheme、不覆寫 DbContext）—— login×4／admin 分頁讀／path-id PUT（`UpdateAccountAsync`→`SaveChangesAsync` 觸發攔截器 Mark→Flush 於重用 context）皆綠；live 啟動零 DI 錯誤＋GetInitialData 經 pooled context 正常供 menus/fabs。
- **同一查詢含「2 個以上 collection-Include」一律加 `.AsSplitQuery()`**：單一 JOIN 載多個一對多 collection 會 cartesian 相乘（列數＝各 collection 列數乘積），EF 每次執行還會印 `MultipleCollectionIncludeWarning`。現役案例：`MenuService.GetMenusAsync`（Menus×結構父子×白名單×黑名單）、`AccountService.GetAccountDetailsAsync`/`UpdateAccountAsync`/`DeleteAccountAsync` 的 reload、`AuthController.MyProfile`（各 5 個 collection）皆已加。本專案讀取多為 `AsNoTracking` 顯示用、DB 已開 `READ_COMMITTED_SNAPSHOT`，拆查詢無一致性疑慮（root 有 PK→collection 子查詢自動有序）。**單一 collection-Include 不需要**（不會 cartesian、無警告，如 Roles/Fabs 的 `MapRoleMenus`/`MapFabRoles`）。勿改全域 `UseQuerySplittingBehavior`（會波及無 OrderBy 查詢的語意）。
- **唯讀 GET 查詢（materialize 整個 entity 再投影成 JSON 回傳）一律加 `.AsNoTracking()`**：省掉 change-tracker 快照／identity-map 開銷。現役已加：`MenuService.GetMenusAsync`、`RolesController.GetRoles`、`FabsController.GetFabs`、`RequestsController.Get`、`AuthController.MyProfile`、`AccountService.GetAccountDetailsAsync`/`GetAccountsPagedAsync`/`GetAccountsForExportAsync`；`SettingsService.GetInitialDataAsync`、`MenuAuthService` 全部讀取本就已 `AsNoTracking`。**嚴禁加在「載 entity 是為了改它」的寫入路徑**（`UpdateAccountAsync`/`DeleteAccountAsync`/`UpdateMenuAsync`/`BatchUpdateMenus`/`PersonalSettings` 的 `RemoveRange` 載入、`MenuService.DetachMenuReferencesAsync` 等）——AsNoTracking 的實體不被追蹤，`SaveChanges` 不會偵測到變更/刪除而靜默失效。寫入路徑的 `.Select(scalar)` 存在性檢查本就不追蹤（moot、加不加皆可，不必動）。
- 取 EmpId **一律走 `ClaimTypes.NameIdentifier`**，**禁止 `User.Identity.Name`**（那是姓名，會讓委派判定全失效）。
- 取 client IP 走 `Helpers/ClientIpHelper.GetClientIp`；XFF 可偽造、**僅供稽核 log、不可用於權限判定**。
- **圖示寫入一律走 `IIconStorageService`，禁止在 Controller 自行存 base64 或拼 icon 路徑**：Create/Update/Delete 都用 `SaveAsync`（存檔回傳路徑）；Update/Delete 必須先 **捕捉 oldIcon → 寫入新值並 SaveChanges 後**，再呼叫 `DeleteIfLocalUnreferencedAsync(oldIcon)` 做孤兒清理（清理在 commit 之後、且帶參照檢查，故安全）。批次端點（`BatchUpdateMenus`/`BatchDeleteMenus`）收集 `oldIcons` list，於交易 commit 後統一清理。
- **Service 層為「部分抽離」**：`Settings`/`Accounts`/`Auth`/`MenuAuth`/`Icon`/`Menus`(`MenuService`，含 BatchUpdate/BatchDelete 等較重邏輯) 已抽成 Service；`Roles`/`Fabs`/`Apps`/`Requests`/`PersonalSettings` 仍把邏輯留在 Controller（單純 CRUD，刻意不過度抽象）。新增複雜邏輯才考慮抽 Service，勿為一致性硬抽。
- **寫入端點的失敗狀態碼語意：`404` 只給「資源真的不存在」、策略/驗證拒絕一律 `400`**。`AccountsController.UpdateAccount`/`DeleteAccount` 皆遵此：`UpdateAccountAsync` 回傳 tuple 帶 `notFound` 旗標（`account==null`→`true`；super-admin 防降級／`ValidateMappingRefsAsync` stale id 失敗→`false`），controller `return notFound ? NotFound(msg) : BadRequest(msg)`。**勿為省事把所有 `(false,msg)` 一刀切成單一狀態碼** —— 「真的找不到」與「存在但被拒」是不同語意（前端雖只看 `res.ok`＋顯示 msg、不受影響，但 REST 語意與除錯/監控靠狀態碼分流）。
- **記錄錯誤一律用注入的 `ILogger<T>`，禁止 `Console.Error.WriteLine`**（IIS 下 stderr 無人接、訊息直接遺失；Serilog 也攔不到）。**`appsettings.json` 的 `Logging:LogLevel` 對 Serilog 無效** —— Serilog 走 `ReadFrom.Configuration` 只讀 `"Serilog"` 區段（本專案三個 appsettings 皆無此段），降噪靠 `Program.cs` 的 `UseSerilog` 內 `.MinimumLevel.Override("Microsoft.AspNetCore"/"Microsoft.EntityFrameworkCore", Warning)`（已設）；要調框架日誌噪音改那裡，別動 `Logging:LogLevel`。

### 6.3 授權/安全（authz）
- **Class-level `[Authorize]` 一律設成最寬鬆 baseline**；要 admin 的 action 自己加 `[Authorize(Roles="admin")]`。class+action 的 `[Authorize]` 是「累加要求」不是 override —— class 設 admin 會把所有非 admin 擋死、整站無 sidebar。
- 非 admin 的 `GetInitialData`/`GetMenus` **必須後端按可見性過濾**（`IMenuAuthService.GetVisibleMenuIdsAsync` + `SettingsController.FilterTable`），不可只靠前端篩選。`GetVisibleMenuIdsAsync` 結果以 `visibleMenus:{ETag}:{empId}` 跨請求快取（ETag 變更即作廢、回傳防禦性副本）；對外回傳值**只能讀（`Contains`）不可就地改動**（會污染共享快取物件）。其 ACL 查詢靠 `IX_Map_Menu_Allow/DenyAccount_EmpId` 走 index seek。
- Menu 權限優先序 **Menu ACL > Account override > Role**；`MenuAuthService` 走 `Map_Menu_Structure` parent chain（對齊前端 `getMenuPermissions`/`isUnderDelegated`）。
- 寫入時 **path id 為事實來源**（函式開頭 `dto.Id = id;` / `dto.EmpId = empId;`），防 path/body 不一致洗他人 mappings。
- `createdBy` 強制為實際登入者 empId（更新時 immutable），防 mass assignment 偽造。
- 非 admin 編輯 menu 一律清空 `dto.AllowedEmpIds/DeniedEmpIds`（不可改他人可見性）。
- **前端 `sysMenus` 各管理頁的 `display` 閘門必須與後端對應 Controller 的 class-level `[Authorize]` 對齊**（`render/sidebar.js` 的 sysMenus 陣列）：`page-account-manage`/`page-fab-manage`/`page-role-manage`/`page-audit-manage`/`page-activity-log`/`page-config-manage` 對應的後端（`AccountsController`/`FabsController`/`RolesController`…）皆 class-level `[Authorize(Roles="admin")]`＝**整支 admin-only**，故 `display` 一律 `role === 'admin'`。唯 `page-webpage-manage`/`page-menu-manage`（後端 `MenusController` 是 `[Authorize]` baseline＋Service 層逐資源委派判定）才用 `canManage`（admin 或被委派者）。**`帳號管理`(page-account-manage) 切勿用 `canEditOthers` 當閘門** —— `canEditOthers` 是「menu 委派旗標」（可編輯所屬子樹下他人建立的看板，見 §7 與 `getMenuPermissions`），**與帳號管理能力無關**；`AccountService` 無任何委派邏輯（只有 super-admin 防護），委派者就算看到此選單，所有 `/api/Accounts` 端點仍一律 403＝功能性死選單。改 sysMenus 閘門時務必回頭核對該頁對應 Controller 的實際 authz。
- CSRF：POST/PUT/DELETE 需 `X-Requested-With` 標頭，失敗回 JSON `{success,message}`。並走 ASP.NET Antiforgery（header `X-CSRF-TOKEN`，token 由 `GET /api/Auth/CsrfToken` 取得）。
- **CSRF 驗證 middleware 必須放在 `UseAuthentication()`／`UseAuthorization()` 之後**（Program.cs）：ASP.NET antiforgery token **綁定登入者 claims 身分**，`ValidateRequestAsync` 會拿 `context.User` 與 token 內嵌身分比對。若驗證 middleware 放在 `UseAuthentication` 之前，驗證當下 `context.User` 仍是匿名 → 已登入者送來的「身分綁定 token」永遠對不上匿名 context → **一律 `CSRF validation failed: Invalid Token`（無論前端怎麼刷新 token 都救不了）**。安全標頭（nosniff/X-Frame-Options）可留在前段；唯獨 antiforgery 驗證一定要後置。
- **前端兩道配套防線**（搭配上面的後端後置才生效）：(1) `auth.js completeLoginAfterAuth` 一進來就 `await window.refreshCsrfToken()` 重取「綁定當前登入身分」的 token；(2) `api.js` 全域 fetch 攔截器對「寫入請求 400 + body 含 Invalid Token」**自動重取 token 並重試一次**（自我修復，兼容伺服器重啟/DP 金鑰更新）。CSRF 標頭一律經 `applyCsrfHeaders()` 以**覆寫**語意設定（重試不疊加多個 token）。改 CSRF 流程務必維持「後端後置驗證 + 前端刷新/重試」三者一致。
- **Content-Security-Policy 設於 `Program.cs` 安全標頭 middleware（與 nosniff/X-Frame-Options 同段，`UseAuthentication` 之前）**：本專案架構決定它**必須含 `'unsafe-inline'`**——(1) 全站大量 inline `onclick=""` → `script-src` 必含 `'unsafe-inline'`；(2) 全站大量 inline `style=""`＋Bootstrap/DataTables 動態注入 `<style>` → `style-src` 必含 `'unsafe-inline'`；(3) 看板以 iframe 載入任意外部 `menu.url` → `frame-src 'self' http: https:`（收緊會讓看板白畫面）；(4) menu/app 圖示為 `data:` URI 或外部 https 圖檔 → `img-src 'self' data: https:`。**CDN allowlist 必含四家**：`cdn.jsdelivr.net`(Bootstrap/SheetJS)、`cdnjs.cloudflare.com`(Font Awesome，含字型故 `font-src` 也要它)、`cdn.datatables.net`(DataTables)、`code.jquery.com`(jQuery)；改版換 CDN 務必同步此清單，否則該資源被 CSP 擋下整個壞掉。即便有 `'unsafe-inline'`，仍靠 `object-src 'none'` / `base-uri 'self'` / `frame-ancestors 'none'` / `form-action 'self'` + script/style source allowlist 顯著縮小攻擊面（**勿因有 unsafe-inline 就移除這些**——它們擋的是不同向量）。**禁止**在此加 nonce/hash（會使 `'unsafe-inline'` 失效→全站 inline handler/style 立刻壞）。**改 CSP 務必 live-test**：載入後瀏覽器 console 須 0 條 `Refused to…`／`securitypolicyviolation`、四家 CDN 全域(jQuery/bootstrap/XLSX/DataTable)皆 truthy、inline onclick 真的執行、inline `<style>` 真的套用、看板 iframe 可載入。
- **CDN `<script>`/`<link>` 一律帶 SRI（`integrity="sha384-…"` + `crossorigin="anonymous"`）**（`index.html` 8 個標籤，與 CSP 互補的縱深防禦：CSP 限制「可載入哪些來源」、SRI 防「來源被竄改」）。**改 CDN 版本／換 CDN 時，URL 與 `integrity` hash 必須同步更新**，否則瀏覽器算出的 hash 對不上 `integrity` → 整個資源被擋下（CSS 不套用／JS 不執行＝全站壞）。**取得 hash 一律對 CDN「實際送出的位元組」算 SHA-384 base64**（`curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`），勿臆測或複製舊版 hash。`crossorigin="anonymous"` 為跨域 SRI 必要（瀏覽器需以 CORS 模式取資源才會驗 integrity）；本專案四家 CDN 皆回 `Access-Control-Allow-Origin: *`，**換 CDN 前務必確認新來源支援 CORS**，否則 `crossorigin` 會讓資源直接 CORS 失敗載不進來。改 SRI 同樣 live-test（console 0 條 integrity/digest 錯誤、四家 CDN 全域皆 truthy、三張外部 stylesheet 在 `document.styleSheets`）。

### 6.4 前端 (JavaScript)
- 全域變數已全面收斂至 `store.js` 的 `appState` 物件（`appState.currentUser/currentFab/currentLang` 等），全面捨棄 `window.*`，所有 JS 檔統一透過 `import { appState } from './store.js'` 存取。
- CRUD 結束走對應 RESTful API（`saveXxxAPI`/`batchSaveMenusAPI`…）即可；`syncDataToDB()`（全量覆寫 `/Settings/SaveData`）僅剩 Excel 匯入用，**勿**用於一般 CRUD/拖曳。
- **看板拖曳排序（系統版面＝全域共用）走 `batchSaveMenusAPI()` 只送異動看板**，禁用 `syncDataToDB()` —— 後者 payload 由 admin 自己 localStorage 重建整張 `PersonalSettings`，會用過時快照洗掉所有人的個人版面。樂觀渲染＋失敗 `fetchInitialDataFromDB()` 回滾。BatchUpdateMenus 會從 dto 重建 SortOrder 與（admin）ACL，黑白名單完整保留。
- **自訂版面（個人上方導覽列，per-user）走 `/api/PersonalSettings`**（`savePersonalSettings` 回傳成敗，呼叫端須偵測失敗、不可假報成功），拖曳儲存即時更新且不影響他人。
- **自訂（personal）模式的 root 排序必須與系統模式同基準（`dedupedInitIds`），個人拖曳順序才優先**：`render/sidebar.js renderSidebarMenus` 的 `rootMenus.sort`（上方導覽列順序事實來源）**不可再用 `if (!inPersonalMode)` 把 `dedupedInitIds` 排序限定在系統模式**。兩模式都走同一 comparator：personal 模式下若該 root 有個人拖曳順序（`pSets[id].order != null`）則優先採用，否則 fallback 到 `dedupedInitIds.indexOf`（＝系統版面同序）。舊 bug：personal 模式略過此排序、退回 line 401 的全域 `m.order` 排序 → **「還原預設版面」(pSets 清空) 後自訂版面上方導覽列順序 ≠ 系統版面**（使用者明確要求「還原後自訂＝系統」）。此邏輯**必須與 `render/tables.js renderPersonalMenuManage` 的 root order fallback（同樣 `pSets[id].order` 優先、否則 `dedupedInitIds.indexOf`）一致** —— 改任一邊務必同步另一邊，確保「上方導覽列 / 個人選單結構表 / 系統版面」三者同序。（已驗證：reorderPersonalMenu 對同層 root 一次重編全部 `order=idx*10`＝all-or-nothing，故 `idx*10` 與 `dedupedInitIds` index 兩種尺度不會在實務上混用。）
- **`PersonalSettings` 為 RESTful-only**：後端 `SettingsService.TableNames` 已**移除** `PersonalSettings`，前端 `getDatabasePayload()` 也**不**再組裝它 —— 故 `SaveData`／Excel 匯入皆不會再碰個人版面表（讀取端 `GetInitialDataAsync` 直接以 `_dbContext.PersonalSettings` 取，與此清單無關）。新增/修改個人版面只能走 `/api/PersonalSettings` per-user delete+insert。`PersonalSettings` 無 FK 到 `Menus`（PK-only），故移出 TableNames 不會卡 `DELETE FROM Menus`。
- **Excel 匯出（`createWorkbookData`）不再產 `PersonalSettings` sheet**：匯入端 `processAndSaveWorkbook` 從不讀此 sheet（個人版面靠 localStorage 非 Excel round-trip），O3 後 localStorage 只剩自己一份，硬匯出只會得到殘缺＋無法還原的資料 → 移除以保持「匯出＝可還原備份」的一致性。
- **localStorage 個人版面只快取「登入者自己」一份**：`fetchInitialDataFromDB` 取得 `MyProfile.empId`（fallback `window.currentUser?.id`）後，只 `setItem('umc_personal_menus_'+myEmpId, …)` 自己這份，且每次載入都覆寫成 DB 真實值（含 DB 已清空→本機也清空）；**禁止**把 `psByEmp` 內他人版面寫進本機。
- **App CRUD 一律走 `saveAppAPI`/`deleteAppAPI`**（靜態 import 必為 function），不再有 `else if syncDataToDB()` 全量覆寫後備（已移除死碼）。
- **管理頁 CRUD（選單配置管理）儲存/刪除後一律「就地刷新」、禁止 `goDefaultHome()`**：`menu-manage.js` 的 `saveMenuNodeItem`／`deleteMenuNodeItem` 成功後只 `hideModalSafely` 關掉編輯 Modal，再 `fetchInitialDataFromDB()` + `renderMenuConfigTable()`/`renderWebpageTable()`/`renderSidebarMenus()` 就地更新，**不可**呼叫 `goDefaultHome()`（那會整頁跳去使用者預設看板，使用者在哪個管理頁編輯就該留在哪頁）。參考正確樣板：`saveWebpageItem`、`toggleMenuEnable`。`goDefaultHome()` 僅保留給「切換系統/個人模式」（`ui/layout.js`）、「切換 Fab」（`render/sidebar-item.js`）、初次載入（`main.js`）等真正需要導頁的場景。
- **「帳號設定」Modal「可視廠區」勾選區（`render/account-ui.js` 的 `renderAccRoleCheckboxes`）label 顯示「所屬廠區名」、但 `value` 仍綁 roleId**：checkbox 綁的是角色（`assignedRoles`），但 `<label>` 文字刻意顯示該角色所屬的廠區名（掃 `getFabs()` 建 `roleId→廠區名[]`，一角色掛多廠以「、」串接、無對應廠區 fallback 群組名）。**`value="${rId}"` 與 class `acc-role-cb` 為權限儲存事實來源、絕不可改成廠區 id**——這是純顯示層，勿因「label 顯示廠區」就誤把綁定值也換成廠區。
- **「帳號設定」預設看板挑選器（`render/account-ui.js` 的 `openMenuSelector`）必須與實際側邊欄 `render/sidebar.js` 的 `renderSidebarMenus` 同樣以「該廠區 role ∩ 帳號可視廠區(`assignedRoles`)」之 `allowedMenuIds`（再往下展開子節點）為範圍過濾、不分 admin/非 admin**：曾有 bug — admin 走特例 `allMenus.forEach(...add 全部)`，導致「只設給 12M 可見的看板，在 12A 的預設看板挑選器也跑出來」。已移除 admin 特例（`activeRoleIds = fabRoleIds.filter(id => assignedRoles.includes(id))`，admin 與一般使用者一致）。**改這兩處（picker 與 sidebar 的可見集合）任一邊，務必同步檢視另一邊，兩者過濾邏輯需保持一致**，否則「挑選器可選的預設頁」會與「切到該廠區實際看得到的看板」對不上（選了反而 fallback 抓第一個）。**挑選器除了「可開啟的看板」也納入「有子選單的資料夾」(folder) 為可選項**（讓管理者把整個群組如「ZE 強化防禦群組」指定為預設首頁）：`viewableMenus` 已**移除** `!== 'folder'` 排除條件、folder 以資料夾 icon＋badge 區隔；**可見集合 `allowedIds` 不變、僅放寬「可被選取的類型」**，與 sidebar 對齊不受影響。配套：`ui/navigation.js` 的 `goDefaultHome` 在 defPage 落在 folder 時，以 `_resolveFolderToFirstLeaf`（只在 `_currentValidMenus` 可見子節點中找、優先可開啟者、否則鑽進第一個子資料夾）展開到第一個可看的子看板，避免登入落在資料夾空殼（`activateMenu` 對 folder 會顯示「內容建置中」）；仍是空資料夾則 defPage=null 交給終極防呆。**挑選器「由已允許的資料夾往下展開子節點」的迴圈必須檢查「全部 `parentIds`」、不可只看 `parentId`／`parentIds[0]`（兩者都只是第一個父節點）**：一個看板可同時掛在多個群組底下（`Map_Menu_Structure` 多列 → `api.js:252` 把每個父節點 push 進 `parentIds` 陣列；而 `m.parentId` 只記第一個結構父）。曾有 bug — 展開只比對 `parentIds[0]`，導致某看板的「被允許群組」若不是其 `parentIds` 的第一個元素就被漏掉 → 挑選器只跑出群組底下「parentIds[0] 剛好等於該群組」的第一個看板（使用者回報「明明有多個看板卻只顯示第一個」）。修法：對每個未加入的 menu 收集 `parentId`＋`ParentMenuId`＋全部 `parentIds`，只要任一父節點在 `allowedIds` 內即加入，**與 `render/sidebar.js` 的 `getAllowedIdsWithHierarchy`（多父展開的事實來源）對齊**——已驗證兩者對同一 role 產生逐一相同的可見集合。新增/修改任何「由允許資料夾往下展開」的邏輯一律走多父比對、勿退回單一父節點。
- **Tree Builder（`admin/menu-manage.js` 的 `tbAddFolder`/`tbAddLink`）的 `div.innerHTML` 模板字面值內每個 `${xxxHtml}` 變數都必須在模板前先宣告**：`tbAddFolder` 的模板用到 `handleHtml`／`removeBtnHtml`／`addChildBtnHtml`（後者＝資料夾內的「加入看板」按鈕，`onclick="window.tbAddLink(this.closest('.tb-folder').querySelector('.tb-children'))"`，僅 `canAddChild` 時才產生）。曾有 regression — 某次清理刪掉了 `const addChildBtnHtml` 定義卻留著模板裡的 `${addChildBtnHtml}` 參照 → 每次執行 `tbAddFolder` 即丟 `ReferenceError: addChildBtnHtml is not defined`，連鎖兩個症狀：(1)**編輯「含子資料夾的群組」（如 ZE 強化防禦群組 → WL子群組）整個失效**——`openAddMenuNodeModal` → `buildTreeUI` 對子資料夾呼叫 `tbAddFolder` 拋錯被 catch、Modal 開不起來；(2)**根層「建立子群組」按鈕（`modals.html` 的 `tbRootAddFolderBtn` → `window.tbAddFolder(treeBuilderContainer)`）點了沒反應**。修法＝補回 const 定義。清死碼時若刪掉某 `*Html` 變數，務必同步移除模板字面值內的 `${...}` 參照（反之亦然）。
- **「群組編輯」Modal「允許存取的選單 (拖曳可排序)」chip 清單只列「最上層 (root) 選單」**：`admin/role-manage.js` 的 `renderRoleMenuCheckboxes` 拖曳結果＝**上方導覽列**顯示順序，上方只放 root 選單；凡掛在其他選單底下的子項目（如 ZE 強化防禦群組底下的 WL子群組、12M EAS 底下的 N-Sys/xHelp）一律不可出現。**root 判定必須同時檢查 `parentId` 與 `parentIds`**：DB `Menus` 表無 `ParentId` 欄位，`api.js` 對有父節點者只填 `parentIds`(陣列)、`parentId` 常為 `undefined`（且 `cleanId(undefined)===''`），故只靠 `parentId` 會把子項目誤判成 root 而漏進清單（舊 bug）。filter 條件：`(!pid) && pids.length===0`。**附帶效應（刻意接受）**：`saveRoleItem` 只收集已渲染 chip 的 `.role-menu-cb:checked`，故對既有「直接授權子項目」的角色再次存檔時，那些子項目授權會被收斂掉——符合「上方只放 root 選單」意圖。label 文字為硬編碼（無 data-i18n）位於 `partials/modals.html`，已由「允許存取的看板」改為「允許存取的選單」。
- **「廠區管理」Modal「套用權限群組」為單選 radio（一個廠區限一個群組）**：`render/tables.js` 的 `renderFabRoleCheckboxes` 用 `type="radio" name="fabRoleRadioGroup"`（非 checkbox），並含一個 `value=""` 的「無 (不指派)」選項（選無＝該廠區 `assignedRoles` 為空＝對所有人隱藏）。class 仍 `fab-role-cb`、value 仍 roleId 不變。`admin/fab-manage.js` 的 `saveFabItem` 收集 `.fab-role-cb:checked` 時**須過濾掉 `value===""`**（否則「無」會塞空字串進 `assignedRoles`）。此單選約束是「可視廠區 label 顯示廠區名」不出現同名廠區重複格的前提（一廠一群組 → roleId↔廠區一對一）。舊資料一廠多群組時，`renderFabRoleCheckboxes` 只取 `selectedIds[0]` 顯示為已選，其餘於下次儲存自動收斂。**注意：此限制僅前端 UI 強制，後端 Fabs controller 未硬擋多 role**，故走 API 仍可塞多個（現況可接受）。
- **「帳號設定」個別覆寫（額外開放/個別封鎖）為 per-fab（綁廠區）**：`render/account-ui.js` 的覆寫區以「設定廠區」按鈕組（`#accOverrideFabSelector`，只列 `fab.assignedRoles ∩ 已勾角色 ≠ ∅` 的可存取廠區）切換 `appState.overrideFab`，狀態存在 `appState.tempExtraMenus`/`tempDenyMenus`＝`{廠區名:[menuId]}`。`renderAccExtraMenuCheckboxes`/`renderAccDenyMenuCheckboxes`/`renderAccEffectivePreview` 皆 **parameterless**（讀 `appState.overrideFab`，勿改回傳參數版）；切換廠區/勾選前一律先 `__persistAccOverrideDom()` 落回 temp。`admin/account-manage.js` 存檔時先 `__persistAccOverrideDom()` 再以 `__getAccessibleOverrideFabs()` 過濾、剔除空陣列組 payload（字典形狀）。**前端 `appState.currentFab`＝廠區名、`Fabs.FabId == 廠區名`**，故 extra/deny 一律以廠區名為 key（與 `defaultPages` 同慣例）。**可見性兩層必須對齊**：後端 `MenuAuthService.GetVisibleMenuIdsAsync` 回「跨所有可存取廠區的 permissive 聯集」（deny 只在所有可存取廠區皆 deny 才移除）僅供過濾資料列；前端 `sidebar.js` 的 `_ovForCurrentFab()` 只取 `appState.currentFab` 那片做真正收斂。改任一邊演算法務必同步另一邊。
- **選單「禁用」(IsEnabled=false) 必須連同整個子樹一起從上方導覽列／側邊欄移除**：`render/sidebar.js` `renderSidebarMenus` 在算 `validMenus` 前，先以 BFS 把所有 `enabled===false` 節點的後代收進 `killSet`，filter 時連同 killSet 一併剔除。**只過濾「自己 `enabled===false`」是不夠的**：子節點已在 `allowedSet` 子節點展開階段被加入，父節點被移除後子節點失去父節點 → 後面 `rootMenus` 的 `hasValidParent` 判定（只查 `validMenus`）會誤判子節點為最上層 → 子看板「升格」冒出在上方導覽列（曾發生：禁用「ZE 強化防禦群組」後 MNOP/WL子群組/ScalingTEST/Non Scaling/BSL 仍顯示）。killSet 走 `window.isParentMatch`（比對 id/name/displayName）與既有子樹遍歷一致；同時修好導覽列、側邊欄樹、`_currentValidMenus`(搜尋/goDefaultHome) 三處。personal 模式因 `m.enabled` 已被個人 hidden 覆寫，故個人隱藏父資料夾亦會連帶隱藏子項（一致、可接受）。
- **廠區無任何可視看板＝顯示中性「空狀態」、非「無權限」警示**：`ui/navigation.js` `goDefaultHome` 在 `defPage` 落空（該廠區零可視看板）時 `navTo('page-unauthorized')`，但 `index.html#page-unauthorized` 已從「黃色 alert＋🔒＋無權限瀏覽＋請聯絡管理員」改為**中性空狀態**（folder-open 灰圖示＋`empty_fab_title`「此廠區尚未配置看板」＋`empty_fab_desc`，i18n 三語齊全）。理由：廠區能被切到代表使用者已有可存取角色，零看板＝該廠區尚未配置看板（非權限問題），原警示框會誤導使用者以為系統出錯或資料遺失。上方導覽列本就因 `renderSidebarMenus` 無 root 而自然留空。**勿改回 lock/警示語氣**；新增類似「空集合」畫面時一律用中性語氣。
- **Excel 匯入（`importConfig`）為破壞性全量覆寫，須二次 `customConfirm`** 後才執行 `runImportConfig`。
- **不用 `localStorage` 存業務資料**，一律走 DB。
- **開啟方式（target）值域＝`iframe`/`blank`/`ie`/`fullscreen`（App 另有 `_blank`），新增值時五處消費端要同步**：(1) `ui/navigation.js activateMenu` 內外兩段 `mTarget` 分支（上方導覽列 root 與側欄 leaf 都走這）；(2) `render/sidebar-item.js` 的 `actionAttr`（blank/ie 直開不換頁，出 `data-action="open-url"/"open-ie"`）；(3) `main.js` 事件委派 handler（open-url/open-ie 皆先過 `safeExternalUrl`）；(4) `render/tables.js` 兩個顯示 map（個人選單表 `targetTextMap`、管理表 `targetMap`）＋`renderAppGrid` 的 actionAttr；(5) `partials/modals.html` 四個下拉（`#wpTarget`/`#nodeTarget`/`#appTarget`/`#personalMenuTarget`）＋config.js 三語 i18n。**`target='ie'`（另開分頁 IE，2026-07-03 新增）**：`navigation.js openInIE(url)` 把 URL 絕對化後導向自訂協定 `ie:<URL>`，交給客戶端協定處理器啟動 iexplore——客戶端須一次性匯入 `wwwroot/tools/install-ie-protocol.reg`（GPO 可派送；Program.cs 靜態檔已映射 `.reg`→`text/plain` 供下載，勿開 ServeUnknownFileTypes）。未註冊協定時瀏覽器**靜默忽略**（不導航不報錯）＝預期行為。Win11/停用 IE 的環境 iexplore 會轉開 Edge，需改用 Edge IE-mode 站台清單（GPO，超出本專案範圍）。後端 Menu/App/PersonalSettings 的 Target 欄皆 `StringLength(20)` 無枚舉限制，新值免改後端。
- **開頁/身分還原一律「靜默修復」、禁止擾民彈窗（2026-07-03 使用者明確要求）**：企業內部員工桌機開頁，有權限者必須直達預設首頁、全程零彈窗。兩個具體規則：(1) `main.js restoreLoginFromStorage` 查無帳號（帳號被刪或 cookie 身分 ≠ localStorage 身分）時**靜默**清 localStorage → return false 交給 `tryAutoLogin` 走 Windows 自動偵測重登，**勿再加回 `umc_account_deleted_hint`／「帳號已被系統管理員移除」彈窗**（有權限者被靜默重登、無權限者自然停在登入框，兩者都不需要提示）；(2) `api.js` 401 攔截器排除清單必含初載四端點（見 §5 MyProfile 條目），冷開頁 401 不觸發 logout/彈窗。
- 看板搜尋只讀 `window._currentValidMenus`（已權限過濾）；**絕不退回未過濾 `getCustomMenus()`**。
- **管理頁 DataTable 必須維持「異動後留在原分頁」**：每個管理表 render 都走「`safeDestroyDataTable('dtX')`（同步摧毀）→ 重建 tbody → `initDataTable('dtX')`（50ms 後重建）」，destroy+recreate 會把 DataTable 重置回第一頁。修法集中於 `render/sidebar.js` —— `safeDestroyDataTable` 在摧毀前以模組級 `_dtPageMemory[tableId] = dt.page()` 記住目前分頁，`initDataTable` 重建後讀回並 `dt.page(targetPage).draw(false)` 還原（`targetPage` 以 `page.info().pages` clamp，資料列變少時退到最後一頁、`draw(false)` 不重置分頁），用畢 `delete` 清掉。**此為單點修補、自動涵蓋所有分頁管理表（dtMenuConfig/dtWebpage/dtAccount/dtFab/dtRole/dtApply/dtAudit），勿在各 render 函式或 `menu-manage.js` 等 handler 內各別處理**。新增管理表沿用 `safeDestroyDataTable`＋`initDataTable` 即自動具備此行為。
- **管理頁 DataTable 必須維持「異動後保留使用者選的每頁筆數 (pageLength)」**：與上一條「留在原分頁」並列的第二維記憶。每個管理表 render 的 destroy+rebuild 若 init config 寫死 `pageLength: 10`，使用者選過的 25/50/100 會在拖曳/編輯儲存/語言切換後跳回 10。修法集中於 `render/sidebar.js`＋session 級 `appState.dtPageLenMemory`（key=tableId，定義於 `store.js`）：`rememberDtPageLen(tableId)` 在「每個 destroy 之前」以 `$('#id').DataTable().page.len()` 抓現值寫入記憶（>0 才存）；`getDtPageLen(tableId, fallback=10)` 讀記憶、無則回 fallback。**所有 DataTable init 的 `pageLength` 一律寫 `getDtPageLen('dtX')`、禁止再寫死數字**；**所有 destroy（含 `safeDestroyDataTable`、`initDataTable` 自身 fallback、`renderPersonalMenuManage`/`renderAccountTable` 語言切換路徑）之前一律先 `rememberDtPageLen('dtX')`**。設計意圖：記憶在 re-render 間存活（拖曳/編輯保留），唯「整頁重整」(模組重載→`appState` 重生→`dtPageLenMemory={}`) 才回預設 10 —— 精確對應「使用者主動改動或整頁重整才回預設、否則 keep」的 UX 要求。**dtAccount 一般刷新走 `ajax.reload(null,false)` 本就不重建、不丟筆數，只語言切換 destroy 路徑需 remember**。新增管理表只要 init 用 `getDtPageLen`＋每個 destroy 前 `rememberDtPageLen` 即自動具備此行為（與 `_dtPageMemory` 的「分頁」記憶兩者互補、各管一維，勿混用）。
- **純「狀態啟用/停用」切換不可重畫整張管理表（避免閃爍）**：`toggleMenuEnable`（選單配置/看板網頁兩表共用的狀態開關 `onchange`）成功後**只** `await fetchInitialDataFromDB()`，**禁止**再呼叫 `renderMenuConfigTable()`/`renderWebpageTable()`。理由：(1) 該列「狀態」欄就是使用者剛點的開關、已反映新值，其餘欄位（名稱/類型/內容/操作鈕）皆與 `enabled` 無關，重建整表純屬浪費且 DataTable destroy/recreate 會整張閃爍；(2) **`fetchInitialDataFromDB()` 內部已 `renderSidebarMenus()`（啟用/停用要連動上方導覽列＋側邊欄可見性）並重畫「當前 active 的」account/role/fab/apply 表，但刻意不碰 menuConfig/webpage 兩表** —— 故這兩表的重畫責任完全在各 handler 手上，狀態切換不呼叫＝不閃爍。僅在 `saveMenuAPI` **失敗**時才 `m.enabled=!isEnabled`＋重畫把開關退回 DB 真實狀態（失敗少見、該分支閃爍可接受）。**編輯/刪除/儲存因列內容真的變了仍須重畫**（靠上一條 `_dtPageMemory` 留在原分頁），與此狀態切換的「不重畫」是兩種情境，勿混用。
- 靜態快取：`.js/.css/.html` 為 `no-cache`（走 304）、圖片/字型保留 7 天（main.js 的 import 不帶版號，長快取會卡子模組）。**`.html` 必須在 no-cache 清單內**：`index.html` 是整套 cache-bust 機制的「載體」（`__APP_VER__` 與所有 `?v=` 版本碼都寫在它裡面），若落入 7 天長快取，部署新版後使用者一般導航（非 F5）最多 7 天拿不到新版本碼 → `?v=` 機制整個被架空。
- **圖示渲染判斷一律用 `iconVal.startsWith('data:') || iconVal.includes('/')` → 出 `<img>`；否則當 FontAwesome class 出 `<i class>`**（FA class 如 `fas fa-folder` 永不含 `/`，路徑 `/images/icons/...` 與 data: URI 才是圖檔）。此判斷散落於 `render/sidebar-item.js`、`render/sidebar.js`、`ui/dialogs.js`(`generateIconHtml`)、`admin/misc-manage.js`(`setIconValToModal`)，改一處要同步四處。（misc-manage.js 另有一處 `startsWith('data:image')` 是 Excel 匯出的長度防呆，**不是**渲染判斷，勿動。）
- **把 id 內嵌進 inline `onclick="fn('${id}')"` 字串字面值前一律經跳脫（`render/tables.js` 的 `_jsArg`），尤其帳號工號**：Windows 網域帳號工號含反斜線（`SARIEL\yu-tinglin`，由 `ClaimTypes.NameIdentifier` 自動建立）；原樣內嵌時 JS parser 把 `\y` 當無效跳脫吞掉反斜線（`'SARIEL\yu-tinglin'==='SARIELyu-tinglin'`）→ `editAccount` 拿到錯 id → `/api/Accounts/{id}` 404 → 靜默 return、Modal 不開＝「點編輯無反應」（曾發生於 serverSide 帳號表）。`_jsArg` 先做 JS 字串跳脫（`\`→`\\`、`'`→`\'`、換行）再做 HTML 屬性跳脫（`&`/`"`/`<`/`>`，順序：先 JS 後 HTML，對應瀏覽器「先 HTML-decode 屬性、再 JS-parse」）。帳號管理表編輯/刪除鈕的 `aId` 已一律經此。**新增任何「把使用者/系統 id 拼進 inline onclick」的渲染，務必經 `_jsArg`（或等效跳脫）**——工號可能含 `\`、引號等特殊字元。
- **模組底部 `window.X = X` 曝露區塊每檔只保留一份**：曾反覆出現「同一區塊被 append 三遍」的等冪重複死碼（已在 tables.js + 12 個模組清掉）。重複是 no-op 但屬冗餘，新增曝露時直接加進既有那一份、勿再貼整塊。清死碼時「可證明等冪重複」可放心刪；但 window 曝露/ES export 的函式即使疑似沒人呼叫也**不要臆測刪除**（可能被 HTML inline `onclick` 以字串引用、難 100% 靜態追蹤）。
- **`render/tables.js renderAccountTable` 是全專案唯一的 `serverSide:true` DataTable，禁止改回 `getAccounts()` 在前端組整表**（O3 後 `getAccounts()`／`appState.accounts` 只回呼叫者自己一列，前端組表只會看到 1 列）。其載重實作（改任一處務必保留，否則重蹈 2026-06-15 的「O3 半套還原」regression）：①自訂 `ajax` 把 DataTables `start/length/search.value` 換算成 `page/pageSize/q` 打 admin-only `GET /api/Accounts`、map `json.items`→6 欄 row、`callback({recordsTotal/recordsFiltered: json.total})`；②**admin-only 閘門**——非 admin 早 return＋摧毀殘留實例＋清 tbody（否則 `main.js` 初載無條件呼叫會對 `/api/Accounts` 連發 403）；③資料刷新（存檔/刪除/刪角色/背景同步）走 `ajax.reload(null,false)` 保留分頁與搜尋字串，**唯語言切換才 destroy+rebuild**（重讀 `getDataTableLang()` 換 DataTable chrome 文字，以模組級 `_accTableLang` 比對）；④編輯/刪除鈕 id 一律經 `_jsArg`（反斜線工號）。與「其餘管理表走 `safeDestroyDataTable`＋`initDataTable` 客戶端重建」是兩套機制，勿混用。對應 Excel 匯出端 `admin/misc-manage.js createWorkbookData` 必為 **async**、走 `GET /api/Accounts/export` 取全部帳號（同理不可用 `getAccounts()`），`exportConfig` 須 `await`。

### 6.5 關鍵函式位置（V2 模組化後）
| 函式 | V2 位置 | 用途 |
| --- | --- | --- |
| `getAllowedIdsWithHierarchy` / `getMenuPermissions` / `renderUserDropdown` | `render/sidebar.js` | 權限展開、三層判定、頭像下拉 |
| `filterSidebarMenus` / `setupSidebarSearch` | `render/sidebar.js` | 看板即時搜尋（只讀 `_currentValidMenus`）|
| `toggleSubMenu` | `render/sidebar-item.js` | collapse 開合 |
| `togglePersonalProp` | `render/tables.js` | 個人模式切換 |
| `goDefaultHome` | `ui/navigation.js` | 預設首頁（用過濾後清單做防呆）|
| `customAlert` / `customConfirm` | `ui/dialogs.js` | 全域對話框 |
| `toggleSidebar` / `togglePin` | `ui/layout.js` | 版面控制 |
| `exportConfig` / `importConfig` / `reorderPersonalMenu` / `deleteApplyItem` | `admin/misc-manage.js` | Excel、拖曳排序、撤回刪除 |
| `showModalSafely` / `hideModalSafely` | `admin/modal-utils.js` | Modal 安全開關 |
| `SaveAsync` / `DeleteIfLocalUnreferencedAsync` / `MigrateBase64IconsAsync` | `Services/IconStorageService.cs` | 圖示存實體檔、孤兒清理、啟動遷移 |

---

## 7. 安全現況（snapshot）

歷經多輪 multi-persona 攻擊矩陣審計，已修補並守住：未註冊/無權限帳號（WhoAmI 攔截、不發 Cookie）、一般使用者（前端隱藏管理 UI + 後端 `[Authorize(Roles="admin")]`/`IMenuAuthService` 403）、委派管理員（path-id 事實來源、ParentId/ParentIds 全驗、parent-chain 權限、ACL 欄位 null、createdBy immutable）、資訊外洩（非 admin 列級過濾機敏表）、Super Admin 防護（`AccountService.cs` 強制阻擋 `empId="admin"` 之降級與刪除）。詳細規則見 §6.2/§6.3。

**未結之機敏項（需使用者親自處理）**：DP 金鑰 `App_Data/keys/*` 曾進 git 歷史＝已外洩，需輪換（刪舊金鑰讓 DataProtection 重生＝登出所有人）。（`testuser` DB 密碼經使用者明示為測試用、可忽略，不列為待辦。）

---

## 8. 待辦（open）
> 已落地的歷史完成項（P1–P4 DB loading 優化、帳號清單去全表化步驟 1）細節見 memory.md §3；此處只留仍開放的待辦。
- [~] **版控收尾**：canonical＝巢狀 `EQDashboard.V2.Web/.git`，已加 `.gitignore`＋`git rm --cached` 停追 bin/obj/.vs/App_Data/appsettings.json/*.csproj.user（staged 未 commit）。**待使用者**：commit（含 `git add` 漏追的源碼）、輪換 §7 外洩 DP 金鑰、（選擇性）filter-repo/BFG 清歷史。
- [~] **GetInitialData 去全表化剩餘項（抗成長，帳號數達數萬才需要、現況無感）**：非 admin 的「全域表」（Menus/Fabs/Roles/Map_Role_Menu/Map_Fab_Role/Map_Menu_Structure/Apps）仍走共享快取＋C# 記憶體過濾，未下推 SQL `WHERE`。**但這些表不隨帳號數成長（N＝選單/角色/廠區數）→ 共享快取為刻意正確設計，勿改下推 SQL**（會破壞跨使用者快取共享）。帳號相關表已 per-caller 點查（P1 完成）。
- [ ] **（未來擴展，現無感）看板數量成長到數百~數千時**：Menu metadata（分類/標籤）、看板樹 lazy render、管理頁 server-side 分頁。

---

## 🔄 每輪對話自動覆盤協定 (Mandatory Per-Task Update)

你（Gemini / Claude）必須將「更新專案文件與記憶」視為每個任務不可分割的最後一步。使用者會同時使用 Gemini 與 Claude 進行本專案（`EQDashboard.V2.Web`）的除錯與開發。每次回答完使用者、或執行完程式碼修改時，**必須自動**執行（不需等使用者提醒）：

1. **更新 `CLAUDE.md`**：若涉及全新的「常用指令」「程式碼規範」或「禁止事項」，立即寫入對應區塊（保持精簡、現況快照，勿累積逐日日誌）。
2. **更新 `memory.md`**：
   - 在 `## 🛤️ 3. 開發歷史與決策日誌` 依今日日期（`YYYY-MM-DD`）追加一筆簡短記錄。
   - 完成待辦則到 `## 🛠️ 4. 進行中與待辦事項` 標記 `[x]` 並移出優先任務。
   - 隱藏邏輯/隱蔽 Bug 沉澱到 `## 🏗️ 1. 系統核心與隱藏邏輯` 或 `## 🐛 2. 踩坑與填坑紀錄`。
3. **同步 `專案架構.md`（條件性）**：`專案架構.md` 為專案結構/各檔案職責的現況快照。**當新增/刪除/移動檔案、或既有檔案職責有實質變動時**，必須同步更新對應條目（目錄樹、逐檔說明表、關鍵跨檔機制），保持與實際程式碼一致；純邏輯微調未動檔案結構則免。
4. **同步 `DB_Table.md` 與產生遠端同步 SQL 檔（條件性，嚴格遵守）**：
   - `DB_Table.md` 為 EQDashboardV2 全表 CREATE TABLE 架構快照（供他機重建/更新表結構）。
   - **遠端主機 DB 同步規範**：使用者的遠端主機已經建立完整的正式/測試資料庫且內部已擁有實際資料。**當任何變動動到 DB 架構時**（新增/刪除表、欄位、索引、FK，含 `SchemaBootstrap.cs`、`Data/Configurations/*` 結構變更等）：
     1. 必須更新 `DB_Table.md` 上方對應的表結構說明。
     2. **必須在目錄下提供/建立一個新增的 SQL 異動檔（`.sql` 檔案，採相容既有資料的增量 DDL／冪等寫法）**。
     3. **必須在 `DB_Table.md` 末尾「5. 架構異動與增量 SQL 紀錄 (Schema Changelog)」依當日日期 (`YYYY-MM-DD`) 往下追加一筆異動說明與對應的 `.sql` 檔名**，供使用者依據日期迅速判斷並於遠端主機執行同步。
5. **執行時機**：在送出「最終答覆文本」之前完成寫入，並在答覆末尾加一行 `*已自動更新 CLAUDE.md 與 memory.md*`（若本輪亦動到 `專案架構.md` 或 `DB_Table.md` 或產生 SQL 檔，於該行一併列出）。

