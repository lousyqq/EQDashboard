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
| 資料保存 | 匯出新的 `.xlsx` 檔案 | 點擊「同步至 DB」呼叫 `/Settings/SaveData` 寫回 MSSQL |
| 個人化設定 | LocalStorage | DB (`PersonalSettings` 表) + LocalStorage 快取 |
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
    ├── appsettings.json               # 全域設定（目前僅 Logging）
    ├── appsettings.Development.json   # 開發環境設定
    ├── Properties\
    │   └── launchSettings.json        # 啟動 Profile（http / https / IIS Express）
    │
    ├── Controllers\
    │   └── SettingsController.cs      # 唯一 Controller：
    │                                  #   GET  /Settings/GetInitialData → 回傳全部 DB JSON
    │                                  #   POST /Settings/SaveData       → 全量覆寫式寫入 DB
    │                                  #   連線字串硬編碼於檔案內（連線 Sariel\EQDashboard）
    │
    └── wwwroot\                       # 前端靜態資源（瀏覽器直接存取）
        ├── index.html                 # 單頁應用 (SPA) 主入口
        ├── favicon.ico
        ├── css\
        │   └── style.css              # 全站樣式
        ├── lib\                       # 預留本地函式庫位置（目前為空，皆走 CDN）
        └── js\
            ├── config.js              # 全域變數、常數、appState 讀取介面
            ├── api.js                 # ⭐ DB 讀寫核心：
            │                          #   - fetchInitialDataFromDB()  讀取並轉換 DB 資料
            │                          #   - getDatabasePayload()      組裝寫入 payload
            │                          #   - syncDataToDB()            觸發後端寫入
            ├── auth.js                # 登入 / 登出邏輯
            ├── ui.js                  # 通用 UI 互動（Sidebar、Modal、Drawer 等）
            ├── render.js              # 各頁面表格與畫面渲染
            ├── admin.js               # 管理頁面 (Fab/Role/Account/Menu/Webpage) 邏輯
            └── main.js                # 進入點：DOMContentLoaded → 載入 DB → 初始化 UI
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
| 連線字串 | 目前硬編碼於 `Controllers/SettingsController.cs:16`，**未放入 appsettings.json** |

### 3.2 前端（全部走 CDN，未使用 npm / bundler）

| 套件 | 版本 | 用途 |
| --- | --- | --- |
| Bootstrap | 5.3.2 | UI 框架 |
| jQuery | 3.7.0 | DataTables 相依 |
| DataTables | 1.13.6 | 表格分頁/排序 |
| Font Awesome | 6.4.0 | 圖示 |
| SheetJS (xlsx) | 0.18.5 | 保留：Excel 匯入/匯出輔助（轉移至 DB 模式後可逐步淘汰） |

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
- `Accounts`：帳號（admin / user，含 RoleLevel 與 CanEditOthers）
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

### 4.3 前端 ↔ DB 欄位對應

前端使用 **camelCase**（如 `m.id`, `m.displayName`），DB 使用 **PascalCase**（如 `MenuId`, `DisplayName`）。
雙向轉換集中在 [EQDashboard/wwwroot/js/api.js](EQDashboard/wwwroot/js/api.js)：

- 讀取：`fetchInitialDataFromDB()` 內 `getVal(obj, key)` 工具無視大小寫抓欄位。
- 寫入：`getDatabasePayload()` 內顯式以 PascalCase 命名欄位。

---

## 5. API 規範

目前僅有兩支 API，採「**全量讀取 / 全量覆寫**」策略：

| Method | Path | 用途 | 回傳格式 |
| --- | --- | --- | --- |
| GET | `/Settings/GetInitialData` | 一次取出 13 張表 | `{ TableName: [ {col: val}, ... ], ... }` |
| POST | `/Settings/SaveData` | 全量覆寫（先 DELETE 再 INSERT，包在 Transaction 內） | `{ success: bool, message: string }` |

### 5.1 寫入流程的安全機制

`SaveData` 內含多層防呆，修改時請保留：

1. **空表略過**：若某表的 payload 完全沒有有效資料 → 不刪除舊資料、不寫入。
2. **表不存在略過**：透過 `INFORMATION_SCHEMA.TABLES` 檢查。
3. **Schema 自動截斷**：依 `CHARACTER_MAXIMUM_LENGTH` 截斷過長字串。
4. **型別自動轉換**：bit / int / float / datetime 依 DB 型別嘗試解析，失敗則寫入 NULL。
5. **SavePoint 隔離單筆失敗**：單筆 INSERT 失敗時僅 rollback 該筆，繼續處理其他資料；最後彙整錯誤訊息回傳前端。
6. **IDENTITY_INSERT** 自動偵測並開關。

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
- **連線字串**：目前硬編碼於 [Controllers/SettingsController.cs:16](EQDashboard/Controllers/SettingsController.cs#L16)。若改為從 `appsettings.json` 讀取，需注意不要在 commit 中洩漏帳密。
- **SQL 安全**：所有使用者輸入欄位值務必走 `SqlParameter`（現有 `AddWithValue` 寫法須保留），**禁止字串拼接** SQL 值。表名為白名單時可拼接（如目前 `tableNames` 陣列）。
- **Transaction**：寫入類 API 一律包 `BeginTransaction()`，並善用 SavePoint 隔離單筆錯誤。
- **錯誤處理**：以 `Json(new { success = false, message = ex.Message })` 形式回傳，方便前端 `customAlert` 顯示。
- **編碼**：所有 C# 檔案以 UTF-8 (BOM optional) 保存，避免中文註解亂碼。

### 6.3 前端 (JavaScript)

- **不引入框架**：維持 jQuery + Vanilla JS + Bootstrap，不引入 React / Vue。
- **全域變數命名**：沿用既有 `currentUser / currentFab / currentLang / currentLayoutMode / modals` 等命名。
- **讀取資料一律走 `getXxx()` 函式**：例如 `getCustomMenus()`、`getAccounts()`、`getFabs()`。**禁止**直接讀 `window.appState.xxx`（除了 `api.js` 內部轉換邏輯外）。
- **欄位存取使用 `getVal(obj, key)`**：在處理後端回傳資料時，避免 PascalCase / camelCase 大小寫差異造成 undefined。
- **修改資料後須觸發同步**：使用者實際操作 (新增/編輯/刪除) 後，要更新 `hasUnsavedChanges = true` 並讓「同步至 DB」按鈕顯示。
- **個人化設定**：`PersonalSettings` 採「DB 為主、LocalStorage 為快取」雙軌：
  - 讀：`fetchInitialDataFromDB()` 把 DB 資料寫入 `umc_personal_menus_<empId>`。
  - 寫：`getDatabasePayload()` 從 LocalStorage 讀回組進 payload。
  - 修改 PersonalSettings 邏輯時，**兩端都要同步更新**。
- **不要使用 `localStorage` 存業務資料**：除 `umc_personal_menus_*`、`umc_current_user`、`umc_user_stats_*` 等既有用途外，新業務一律走 DB。
- **CDN 與離線**：目前所有前端套件走 CDN，若公司內網不通需切換到 `wwwroot/lib`，請集中在 `index.html` 一次調整。

### 6.4 命名與檔案放置

| 類型 | 位置 |
| --- | --- |
| 新增 API Controller | `EQDashboard/Controllers/XxxController.cs` |
| 新增前端模組 | `EQDashboard/wwwroot/js/xxx.js`，並在 `index.html` 對應位置 `<script src>` |
| 新增 CSS | 優先擴充 `wwwroot/css/style.css`；不切多檔避免請求數增加 |
| 新增上傳圖檔 | `wwwroot/uploads/icons/`（依 SOP 文件規定） |

### 6.5 Git 提交

- 沿用既有風格（觀察 `git log`：簡短中文描述，例：`修正 Git 合併衝突並更新邏輯`）。
- **不提交** `bin/`、`obj/`、`.vs/` 內的編譯產物（若需要，補上 `.gitignore`）。
- 涉及 DB Schema 變動時，**同步更新** `參考網頁/MSSQL_DB架構.sql`。

### 6.6 除錯與本機測試

1. 開啟 `EQDashboard.sln` → F5（或 `dotnet run --project EQDashboard`）。
2. 預設瀏覽器會自動開到 `http://localhost:5242` 或 `https://localhost:7033`。
3. 登入測試帳號：`admin` / `user`（密碼欄位目前未驗證，預設 `123456` 即可）。
4. 若資料庫為空，`auth.js` 內有「臨時 admin 通道」可登入做後續設定。
5. 後端例外 / 警告會 `Console.WriteLine` 到 .NET 主控台（VS 輸出視窗）。
6. 前端錯誤可在瀏覽器 DevTools Console 觀察，注意 `main.js` 末段對 `toLowerCase / browserLink` 類底層錯誤有靜默攔截。

---

## 7. 與舊版 (TEST_20260429.html) 對齊清單

修改任何功能時，請對照以下清單確認新版行為與舊版一致：

- [ ] 全域導覽列：Logo、麵包屑、廠區切換、語言切換、版面切換 (系統/自訂)
- [ ] 沉浸模式 (Fullscreen) 與邊緣感應喚醒 (Edge Triggers)
- [ ] 釘選/自動隱藏 (Pin & Auto-Hide) 行為
- [ ] 個人頁面：顯示/隱藏、拖曳排序、圖示挑選（FontAwesome class 或 Base64 圖片）
- [ ] 看板網頁管理 (Pool Items)：Link / AppGrid 模式
- [ ] 選單配置管理 (Tree Builder)：父子節點綁定、排序
- [ ] 廠區與權限群組 (Fab & Role) 管理
- [ ] 帳號與委派管理 (Offcanvas Drawer + 即時搜尋)
- [ ] 需求申請與審核 (ITSM)：pending → processing → resolved/rejected
- [ ] 應用集合模組 (App Grid)

詳細各頁面需求請見 [EQDashboard.md](EQDashboard.md) 第 5 節。

---

## 8. 已知待修正項目（截至目前）

- 部分功能畫面可正常呈現，但操作後寫回 DB 的細節仍待逐項驗證。
- `Requests` 表的 `Fab` 欄位於 `MSSQL_DB架構.sql:70` 行末誤用分號 `;`（應為 `,` 或結尾 `)`），建表時須注意。
- 連線字串硬編碼，未來建議搬遷到 `appsettings.json` 或環境變數。
- `wwwroot/lib/` 為空，全部走 CDN；若部署到無外網環境需先離線化。
