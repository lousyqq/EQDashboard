# EQ Performance Dashboard - 專案說明文件 (CLAUDE.md)

> 本文件提供 Claude 在此專案下進行開發、修改、除錯時所需的最小必要知識。
> 主要目的：將原本 `參考網頁/TEST_20260429.html` 中「讀取 Excel (`EQDashboard_Setting.xlsx`)」的單檔模式，
> 改寫為「執行 .NET 專案後，透過 Web API 自動讀寫 MSSQL 資料庫」的 Web 模式。
> **兩個版本除了資料來源 (Excel → DB) 外，畫面、互動與功能必須 100% 一致。**

---

## 1. 專案定位與運行模式

| 項目 | 舊版 (參考網頁) | 新版 (本專案) |
| --- | --- | --- |
| 啟動方式 | 直接以瀏覽器開啟 `TEST_20260429.html` | 執行 `EQDashboard.sln` → 啟動 ASP.NET Core Kestrel/IIS Express |
| 資料來源 | 開啟後讀取 `EQDashboard_Setting.xlsx` | 啟動後呼叫 `/Settings/GetInitialData` 讀取 MSSQL |
| 資料保存 | 匯出新的 `.xlsx` 檔案 | **任何 CRUD 異動皆自動靜默呼叫 `/Settings/SaveData` 寫回 MSSQL**（已移除頂部「同步至 DB」按鈕） |
| 個人化設定 | LocalStorage | DB (`PersonalSettings` 表) + LocalStorage 快取 |
| 登入統計 | LocalStorage (`umc_user_stats_*`) | DB (`Accounts.LoginCount` / `Accounts.LastLoginTime`)，登入時呼叫 `/Settings/UpdateLoginStats` |
| 預設 URL | 本機檔案 | `http://localhost:5242` / `https://localhost:7033` |

---

## 2. 檔案結構 (File Structure)

```
C:\EQDashboard\EQDashboard\
├── EQDashboard.sln                    # Visual Studio 方案檔
├── EQDashboard.md                     # 系統 SOP 文件（架構說明、Sync 策略、各頁需求）
├── CLAUDE.md                          # 本檔（給 AI 助手的開發指引）
│
├── 參考網頁\                          # 原始參考資料（唯讀，請勿修改）
│   ├── TEST_20260429.html             # 舊版單檔 HTML（功能基準畫面）
│   ├── EQDashboard_Setting.xlsx       # 舊版資料來源 Excel
│   └── MSSQL_DB架構.sql               # DB 建表 SQL（新版資料庫結構）
│
└── EQDashboard\                       # ASP.NET Core 9.0 Web 專案
    ├── EQDashboard.csproj             # 專案檔（含 NuGet 套件）
    ├── Program.cs                     # 進入點：註冊 Controller、靜態檔、路由
    ├── appsettings.json               # 全域設定（Logging + ConnectionStrings:EQDashboard）
    ├── appsettings.Development.json   # 開發環境設定
    ├── Properties\
    │   └── launchSettings.json        # 啟動 Profile（http / https / IIS Express）
    │
    ├── Controllers\
    │   └── SettingsController.cs      # 唯一 Controller，三支 API：
    │                                  #   GET  /Settings/GetInitialData    → 回傳全部 DB JSON
    │                                  #   POST /Settings/SaveData          → 全量覆寫式寫入 DB
    │                                  #   POST /Settings/UpdateLoginStats  → 登入時 +1 與更新時間
    │                                  #   連線字串改由 IConfiguration 從 appsettings.json 讀取
    │
    └── wwwroot\                       # 前端靜態資源（瀏覽器直接存取）
        ├── index.html                 # 單頁應用 (SPA) 主入口
        ├── favicon.ico
        ├── css\
        │   └── style.css              # 全站樣式
        ├── lib\                       # 預留本地函式庫位置（目前為空，皆走 CDN）
        └── js\
            ├── config.js              # 全域變數、常數、appState 讀取介面、i18n 翻譯表
            ├── api.js                 # ⭐ DB 讀寫核心：
            │                          #   - fetchInitialDataFromDB()  讀取並轉換 DB 資料
            │                          #   - getDatabasePayload()      組裝寫入 payload（含 LoginCount/LastLoginTime）
            │                          #   - syncDataToDB(showFeedback) 觸發後端寫入（一般 CRUD 靜默；匯入時 true）
            ├── auth.js                # 登入 / 登出：呼叫 UpdateLoginStats、寫入 currentUser
            ├── ui.js                  # 通用 UI 互動（Sidebar、Modal、Drawer、語言切換、釘選、沉浸模式）
            ├── render.js              # 各頁面表格與畫面渲染、toggleSubMenu、getMenuPermissions、renderUserDropdown
            ├── admin.js               # 管理頁面 (Fab/Role/Account/Menu/Webpage/Personal/Apply/Audit/AppGrid) 邏輯、Excel 匯入匯出
            └── main.js                # 進入點：DOMContentLoaded → 載入 DB → 初始化 UI、套用廠區預設語言
```

### 2.1 前端 JS 載入順序（index.html 末端）

```
config.js → api.js → auth.js → ui.js → render.js → admin.js → main.js
```

> 後續檔案會覆寫前者的同名 `window.*` 函式（例如 `api.js` 末段會覆寫 `getCustomMenus` 等讀取函式以強制走 DB）。新增程式碼時請注意載入順序與覆寫關係。

---

## 3. 技術版本 (Tech Stack)

### 3.1 後端

| 項目 | 版本 / 說明 |
| --- | --- |
| .NET SDK | **.NET 9.0** (`<TargetFramework>net9.0</TargetFramework>`) |
| Web 框架 | ASP.NET Core MVC + Static Files |
| Nullable | `enable` |
| ImplicitUsings | `enable` |
| NuGet：`Microsoft.Data.SqlClient` | 7.0.1 |
| NuGet：`System.Data.SqlClient` | 4.9.1（與上者並存，目前 Controller 使用 `System.Data.SqlClient`） |
| DB | **MSSQL**（Server: `Sariel`, Database: `EQDashboard`, User: `testuser`）|
| 連線字串 | 已搬至 `appsettings.json` 的 `ConnectionStrings:EQDashboard`，由 `IConfiguration` 注入 |

### 3.2 前端（全部走 CDN，未使用 npm / bundler）

| 套件 | 版本 | 用途 |
| --- | --- | --- |
| Bootstrap | 5.3.2 | UI 框架 |
| jQuery | 3.7.0 | DataTables 相依 |
| DataTables | 1.13.6 | 表格分頁/排序 |
| Font Awesome | 6.4.0 | 圖示 |
| SheetJS (xlsx) | 0.18.5 | 設定檔管理頁的「匯入」與「匯出 Excel 備份」功能仍使用 |

### 3.3 啟動 Profile (`Properties/launchSettings.json`)

| Profile | URL |
| --- | --- |
| http | `http://localhost:5242` |
| https | `https://localhost:7033;http://localhost:5242` |
| IIS Express | `http://localhost:45686` / SSL `44356` |

---

## 4. 資料模型 (Database Schema)

完整建表 SQL 位於 [參考網頁/MSSQL_DB架構.sql](參考網頁/MSSQL_DB架構.sql)。
共 **13 張表**，分為「實體表」與「關聯表 (Map_*)」：

### 4.1 實體表

- `Menus`：系統選單（含 PoolItem 旗標、全域排序）
- `Fabs`：廠區（12A / 12M / 12i）
- `Roles`：權限群組
- `Accounts`：帳號（admin / user，含 RoleLevel / CanEditOthers / **LoginCount** / **LastLoginTime**）
- `Apps`：應用集合模組項目（含 Base64 圖示）
- `Requests`：需求申請與審核單
- `PersonalSettings`：個人化選單設定（複合主鍵 EmpId + MenuId）

### 4.2 關聯表 (多對多 / 階層)

- `Map_Fab_Role`：廠區 ↔ 角色
- `Map_Account_Role`：帳號 ↔ 角色
- `Map_Account_ManageMenu`：帳號 ↔ 可管理選單（委派）
- `Map_Role_Menu`：角色 ↔ 可看選單（含 SortOrder）
- `Map_Menu_Structure`：選單父子結構（ParentMenuId / ChildMenuId / SortOrder）
- `Map_Account_DefaultPage`：帳號於不同廠區的預設首頁

### 4.3 累計補強的 DDL（需在 SSMS 執行一次）

```sql
USE EQDashboard;
GO

-- Accounts 表新增登入統計欄位（若呼叫 UpdateLoginStats 時欄位不存在，後端會自動補）
IF COL_LENGTH('Accounts','LoginCount') IS NULL
    ALTER TABLE Accounts ADD LoginCount INT NULL;
IF COL_LENGTH('Accounts','LastLoginTime') IS NULL
    ALTER TABLE Accounts ADD LastLoginTime DATETIME NULL;
UPDATE Accounts SET LoginCount = 0 WHERE LoginCount IS NULL;
```

### 4.4 前端 ↔ DB 欄位對應

前端使用 **camelCase**（如 `m.id`, `m.displayName`、`a.loginCount`、`a.lastLoginTime`），DB 使用 **PascalCase**（如 `MenuId`, `DisplayName`、`LoginCount`、`LastLoginTime`）。
雙向轉換集中在 [EQDashboard/wwwroot/js/api.js](EQDashboard/wwwroot/js/api.js)：

- 讀取：`fetchInitialDataFromDB()` 內 `getVal(obj, key)` 工具無視大小寫抓欄位。
- 寫入：`getDatabasePayload()` 內顯式以 PascalCase 命名欄位。**Accounts 的 LoginCount / LastLoginTime 必須在 payload 帶上**，否則自動同步全表覆寫時會把這兩欄洗成 NULL。

---

## 5. API 規範

目前共三支 API：

| Method | Path | 用途 | 回傳格式 |
| --- | --- | --- | --- |
| GET | `/Settings/GetInitialData` | 一次取出 13 張表 | `{ TableName: [ {col: val}, ... ], ... }` |
| POST | `/Settings/SaveData` | 全量覆寫（先 DELETE 再 INSERT，包在 Transaction 內） | `{ success: bool, message: string }` |
| POST | `/Settings/UpdateLoginStats` | 登入時呼叫：`LoginCount += 1` 與 `LastLoginTime = GETDATE()` | `{ success: bool, loginCount: int, lastLoginTime: "yyyy-MM-dd HH:mm:ss" }` |

### 5.1 寫入流程的安全機制（`SaveData`）

`SaveData` 內含多層防呆，修改時請保留：

1. **空表略過**：若某表的 payload 完全沒有有效資料 → 不刪除舊資料、不寫入。
2. **表不存在略過**：透過 `INFORMATION_SCHEMA.TABLES` 檢查。
3. **筆數銳減防呆**：若舊筆數 ≥ 5 且新筆數 < 舊筆數 × 20%，**拒絕覆寫**並記入 errorLogs（避免前端 bug 把整表清空）。
4. **Schema 自動截斷**：依 `CHARACTER_MAXIMUM_LENGTH` 截斷過長字串。
5. **型別自動轉換**：bit / int / float / datetime 依 DB 型別嘗試解析，失敗則寫入 NULL。
6. **SavePoint 隔離單筆失敗**：單筆 INSERT 失敗時僅 rollback 該筆，繼續處理其他資料；最後彙整錯誤訊息回傳前端。
7. **IDENTITY_INSERT** 自動偵測並開關。

### 5.2 登入流程的自動補欄位（`UpdateLoginStats`）

進入點會先執行 `IF COL_LENGTH('Accounts','LoginCount') IS NULL ALTER TABLE Accounts ADD ...`，缺欄位時自動補上，避免使用者忘了跑 §4.3 的 DDL。

### 5.3 前端同步策略

- `syncDataToDB(showFeedback)` 為唯一寫入入口：
  - `showFeedback = false`（預設）→ 靜默同步，不彈 loading 遮罩、不彈成功訊息；用於所有 CRUD 與拖曳排序。
  - `showFeedback = true` → 顯示 loading 與結果訊息；目前只有「Excel 匯入」與「設定檔管理頁的強制全量寫入按鈕」會傳 `true`。
- 任何 CRUD 結束後**必須**呼叫 `syncDataToDB()`；對齊舊版「即改即存」體驗（已不再使用 `hasUnsavedChanges` 旗標與頂部按鈕）。

---

## 6. 開發規範 (Development Conventions)

### 6.1 通用原則

- **畫面一致性優先**：任何 UI / 互動改動，都必須對照 `參考網頁/TEST_20260429.html` 的呈現與行為。若行為不同，預設以舊版為準，除非使用者明確指示改動。
- **不破壞既有資料結構**：`appState` 結構（`menus / fabs / roles / accounts / apps / requests`）已被多處依賴，新增欄位時用擴充而非取代。
- **避免引入 build pipeline**：目前前端為純靜態檔，請勿擅自引入 webpack / vite / TypeScript / npm 等流程。
- **避免新增第三方 NuGet**：除非有強烈理由，否則沿用現有 `Microsoft.Data.SqlClient` 即可。
- **不要新增 .md 文件**：除使用者明確要求，不主動建立 README、CHANGELOG 等。

### 6.2 後端 (C#)

- **Controller 命名**：保持與 URL 對應的 `XxxController : Controller`，方法回傳 `JsonResult` 或 `Task<JsonResult>`。
- **連線字串**：在 [appsettings.json](EQDashboard/appsettings.json) 的 `ConnectionStrings:EQDashboard`，Controller 透過 `IConfiguration` 注入；若該設定不存在，會 fallback 至硬編碼字串。
- **SQL 安全**：所有使用者輸入欄位值務必走 `SqlParameter`（現有 `AddWithValue` 寫法須保留），**禁止字串拼接** SQL 值。表名為白名單時可拼接（如目前 `tableNames` 陣列）。
- **Transaction**：寫入類 API 一律包 `BeginTransaction()`，並善用 SavePoint 隔離單筆錯誤。
- **錯誤處理**：以 `Json(new { success = false, message = ex.Message })` 形式回傳，方便前端 `customAlert` 顯示。
- **Schema 異動**：能用 `IF COL_LENGTH(...) IS NULL ALTER TABLE` 在 Controller 自動補欄位的，盡量做（讓使用者不必手動跑 DDL），同時也要把 DDL 寫進 §4.3。
- **編碼**：所有 C# 檔案以 UTF-8 (BOM optional) 保存，避免中文註解亂碼。

### 6.3 前端 (JavaScript)

- **不引入框架**：維持 jQuery + Vanilla JS + Bootstrap，不引入 React / Vue。
- **全域變數命名**：沿用既有 `currentUser / currentFab / currentLang / currentLayoutMode / modals` 等命名。
  - `currentFab` 一律使用 **fabName**（非 fabId），由 `initDashboardUI` 帶入第一個廠區。
  - `currentLayoutMode` 一律使用字串 `'system'` 或 `'personal'`（**不要寫 `'custom'`**，否則 `renderSidebarMenus` 內判斷會失效）。
- **讀取資料一律走 `getXxx()` 函式**：例如 `getCustomMenus()`、`getAccounts()`、`getFabs()`。**禁止**直接讀 `window.appState.xxx`（除了 `api.js` 內部轉換邏輯外）。
- **欄位存取使用 `getVal(obj, key)`**：在處理後端回傳資料時，避免 PascalCase / camelCase 大小寫差異造成 undefined。
- **CRUD 結束後必呼叫 `syncDataToDB()`（靜默版）**：對齊「即改即存」體驗，已移除舊版的「同步至 DB」按鈕與 `hasUnsavedChanges` 旗標。
- **inline onclick 注意引號注入**：含使用者輸入或廠區名等字串時，改用 `data-xxx` 屬性 + `addEventListener` 委派（範例：`renderAccDefaultPagesUI` 的 `.js-pick-default` / `.js-clear-default`）。
- **個人化設定**：`PersonalSettings` 採「DB 為主、LocalStorage 為快取」雙軌：
  - 讀：`fetchInitialDataFromDB()` 把 DB 資料寫入 `umc_personal_menus_<empId>`。
  - 寫：`getDatabasePayload()` 從 LocalStorage 讀回組進 payload。
  - 修改 PersonalSettings 邏輯時，**兩端都要同步更新**。
- **不要使用 `localStorage` 存業務資料**：除 `umc_personal_menus_*`、`umc_current_user`、`umc_user_stats_*`（後者已改為備援）等既有用途外，新業務一律走 DB。
- **不要把 `console.log` 留在 production**：除錯用的 log 上線前請註解或移除（已清除多處）。
- **CDN 與離線**：目前所有前端套件走 CDN，若公司內網不通需切換到 `wwwroot/lib`，請集中在 `index.html` 一次調整。

### 6.4 關鍵函式所在位置（避免重複實作）

| 函式 | 位置 | 用途 |
| --- | --- | --- |
| `getAllowedIdsWithHierarchy(menus, initialIds)` | `render.js` | 遞迴展開所有子節點的允許 ID |
| `getMenuPermissions(nodeId, createdBy)` | `render.js` | admin / user / 委派 三層權限判定 |
| `toggleSubMenu(e, targetId, element)` | `render.js` | 自製 collapse 開合（取代 Bootstrap `data-bs-toggle`） |
| `renderUserDropdown()` | `render.js` | 右上角頭像下拉資訊（姓名、部門、累積登入次數、本次登入時間） |
| `togglePersonalProp(menuId, prop, value)` | `render.js` | 個人模式下顯示/隱藏切換，雙寫 LocalStorage + 自動同步 DB |
| `togglePerMenuRow(menuId)` | `render.js` | 個人頁面表格列展開/收合 |
| `goDefaultHome()` | `ui.js` | 廠區/帳號/folder 三段邏輯決定預設首頁 |
| `deleteApplyItem(id)` | `admin.js` | 撤回後刪除申請紀錄 |
| `exportConfig()` / `createWorkbookData()` | `admin.js` | 匯出 EQDashboard_Setting.xlsx 備份 |
| `reorderPersonalMenu(srcId, targetId, parentId)` | `admin.js` | 個人模式拖曳排序（root 與 sub 分開過濾） |

### 6.5 命名與檔案放置

| 類型 | 位置 |
| --- | --- |
| 新增 API Controller | `EQDashboard/Controllers/XxxController.cs` |
| 新增前端模組 | `EQDashboard/wwwroot/js/xxx.js`，並在 `index.html` 對應位置 `<script src>` |
| 新增 CSS | 優先擴充 `wwwroot/css/style.css`；不切多檔避免請求數增加 |
| 新增上傳圖檔 | `wwwroot/uploads/icons/`（依 SOP 文件規定） |

### 6.6 Git 提交

- 沿用既有風格（觀察 `git log`：簡短中文描述，例：`修正 Git 合併衝突並更新邏輯`）。
- **不提交** `bin/`、`obj/`、`.vs/` 內的編譯產物（若需要，補上 `.gitignore`）。
- 涉及 DB Schema 變動時，**同步更新** `參考網頁/MSSQL_DB架構.sql` 與本檔 §4.3。

### 6.7 除錯與本機測試

1. 開啟 `EQDashboard.sln` → F5（或 `dotnet run --project EQDashboard`）。
2. 預設瀏覽器會自動開到 `http://localhost:5242` 或 `https://localhost:7033`。
3. 登入測試帳號：`admin` / `user`（密碼欄位目前未驗證，預設 `123456` 即可）。
4. 若資料庫為空，`auth.js` 內有「臨時 admin 通道」可登入做後續設定（**注意：此通道僅供開發；正式環境必須移除**）。
5. 後端例外 / 警告會 `Console.WriteLine` 到 .NET 主控台（VS 輸出視窗）。
6. 前端錯誤可在瀏覽器 DevTools Console 觀察，注意 `main.js` 末段對 `toLowerCase / browserLink` 類底層錯誤有靜默攔截。
7. **若 `dotnet build` 出現 MSB3027 / MSB3021 檔案鎖定錯誤**：代表 `EQDashboard.exe` 仍在執行中（VS 或 IIS Express），先停止再重建。

---

## 7. 與舊版 (TEST_20260429.html) 對齊清單

修改任何功能時，請對照以下清單確認新版行為與舊版一致：

- [x] 全域導覽列：Logo、麵包屑、廠區切換、語言切換、版面切換 (系統/自訂)
- [x] 沉浸模式 (Fullscreen) 與邊緣感應喚醒 (Edge Triggers)
- [x] 釘選/自動隱藏 (Pin & Auto-Hide) 行為（取消釘選不立即隱藏，等滑鼠移出再隱藏）
- [x] 多語 (i18n) 翻譯：zh / en / ja；廠區切換時自動套用該廠區 defaultLang
- [x] 個人頁面：顯示/隱藏、拖曳排序（root 拖曳會即時更新上方頁籤）、樹狀展開收合、圖示挑選
- [x] 個人模式下 admin 也要遵守自己設定的 hidden（個人視角，不再讓 admin 看到全部）
- [x] 看板網頁管理：只列 `isPoolItem === true` 的池中項目；表格第 4 欄為「開啟模式（上）+ 完整網址（下，會自動換行）」
- [x] 選單配置管理：父子節點綁定、排序、解除綁定後孤兒節點自動 `isPoolItem = true` 回到看板池
- [x] 廠區與權限群組管理（拖曳排序 + Map_Role_Menu）
- [x] 帳號與委派管理（Offcanvas Drawer + 即時搜尋）
- [x] 需求申請與審核 (ITSM)：pending → processing → resolved/rejected；撤回後可刪除紀錄
- [x] 應用集合模組 (App Grid)
- [x] 右上角頭像下拉：姓名 / 部門 / 累積登入次數 / 本次登入時間（皆走 DB）
- [x] 設定檔管理：Excel 匯入、Excel 匯出備份、強制全量寫入 DB

詳細各頁面需求請見 [EQDashboard.md](EQDashboard.md) 第 5 節。

---

## 8. 已知待修正項目（截至目前）

- `Requests` 表的 `Fab` 欄位於 `MSSQL_DB架構.sql:70` 行末誤用分號 `;`（應為 `,` 或結尾 `)`），建表時須注意。
- `wwwroot/lib/` 為空，全部走 CDN；若部署到無外網環境需先離線化（集中在 `index.html` 換 src）。
- `auth.js` 臨時 admin 通道仍在（資料庫空白時免密碼放行），**正式環境必須移除**。
- `SettingsController` 缺 `[Authorize]` 與 anti-forgery token；目前依靠網路隔離，未來上正式環境前須補上真實登入機制。
- 連線字串中的密碼以明文寫在 `appsettings.json`，未來建議改用 User Secrets / Azure Key Vault / 環境變數。
- `index.html:137` 的 `feedback-link` 仍是範例網址 `your-feedback-url.com`，需換為實際 URL。

---

## 9. 變更紀錄摘要（重大架構/行為調整）

> 本節記錄與舊版 `TEST_20260429.html` 對齊過程中、新版專案實際做過的關鍵調整；補完新功能時請依此原則。

| 主題 | 變更 |
| --- | --- |
| 同步策略 | 移除頂部「同步至 DB」按鈕；所有 CRUD/拖曳結束時自動靜默呼叫 `syncDataToDB()` |
| 登入統計 | 從 LocalStorage 改為 DB（`Accounts.LoginCount` / `LastLoginTime`），登入時走 `/Settings/UpdateLoginStats` |
| 連線字串 | 從 Controller 硬編碼改為 `appsettings.json` 的 `ConnectionStrings:EQDashboard` |
| 寫入防呆 | `SaveData` 新增「新筆數 < 舊筆數 × 20%（且舊筆數 ≥ 5）拒絕覆寫」機制 |
| 看板網頁表格 | 第 4 欄改為直立兩列：上為開啟模式、下為完整網址（`word-break:break-all`） |
| 個人模式行為 | admin 在 personal 模式時也要套用 hidden 過濾；root 拖曳會即時更新上方頁籤 |
| `currentLayoutMode` | 統一字串為 `'system'` / `'personal'`（曾誤用 `'custom'` 已撤回） |
| `i18n` 物件 | 從舊版移植回 `config.js`（zh / en / ja 三組） |
| 補回的函式 | `toggleSubMenu`、`getAllowedIdsWithHierarchy`、`getMenuPermissions`、`renderUserDropdown`、`deleteApplyItem`、`exportConfig` / `createWorkbookData` |
| Excel 匯出 | 在「設定檔管理」頁加上「匯出 Excel 備份」按鈕（呼叫 `exportConfig()`） |
| 效能 | `enforceSystemModeUI` 的 `MutationObserver` 從監聽整個 `<body>` 改為只監聽 `#dynamic-sidebar-menus` |
