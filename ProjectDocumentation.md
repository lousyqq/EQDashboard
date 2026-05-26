# EQDashboard 專案架構與原始碼說明文件

這份文件根據目前的 `EQDashboard` 專案目錄結構與原始碼檔案內容所整理，旨在提供專案架構概觀與重要模組的說明，特別針對前端核心 `admin.js` 及後端 API 控制器進行解析。

## 1. 專案基礎架構

本專案為一個基於 **ASP.NET Core (MVC/Web API)** 的 Web 應用程式，並採用前後端分離的架構，前端完全以 Vanilla JavaScript (原生 JS)、HTML 與 CSS 開發，放置於 `wwwroot` 目錄下。

### 目錄與檔案結構
```text
C:\EQDashboard\EQDashboard\EQDashboard\
│
├── Controllers/
│   └── SettingsController.cs   # 後端核心 API 控制器，負責資料庫存取與同步
│
├── wwwroot/                    # 靜態檔案目錄 (前端應用程式所在)
│   ├── index.html              # 系統唯一入口網頁 (Single Page Application 概念)
│   ├── css/
│   │   └── style.css           # 系統主樣式表
│   ├── js/                     # 前端 JavaScript 模組 (拆分職責)
│   │   ├── admin.js            # 後台管理、CRUD 表單與拖曳邏輯 (核心檔案)
│   │   ├── api.js              # 負責與後端 SettingsController 進行 Ajax 溝通
│   │   ├── auth.js             # 權限驗證與登入相關邏輯
│   │   ├── config.js           # 系統環境設定與常數定義
│   │   ├── main.js             # 系統初始化的進入點
│   │   ├── render.js           # 負責將資料渲染成 HTML 畫面 (如 Table、選單)
│   │   └── ui.js               # 負責共通的 UI 互動與動畫效果
│   └── lib/                    # 外部套件庫 (例如 Bootstrap, jQuery 等)
│
├── appsettings.json            # 系統組態檔 (包含資料庫連線字串等設定)
├── Program.cs                  # ASP.NET Core 進入點與 Middleware 設定
└── EQDashboard.csproj          # C# 專案定義檔
```

## 2. 後端核心: `SettingsController.cs`

本系統後端主要作為資料存取的橋樑。`SettingsController` 提供了 JSON 格式的 API 供前端呼叫：

- **資料庫連線:** 預設讀取 `appsettings.json` 中的 `ConnectionStrings:EQDashboard`。
- **資料表涵蓋:** 包括 `Menus`, `Fabs`, `Roles`, `Accounts`, `Apps`, `Requests` 等多張系統管理資料表。
- **核心 API 端點:**
  - `[HttpGet] GetInitialData()`: 一次性撈取資料庫內的所有基礎資料 (Tables)，回傳給前端作為初始快取 (JSON)。
  - `[HttpPost] SaveData()`: 接收前端傳來的完整 JSON payload。採用交易 (Transaction) 機制，並實作了防呆保護 (例如筆數異常縮減拒絕覆寫)，支援動態型別判定將資料寫回 SQL Server。
  - `[HttpPost] UpdateLoginStats()`: 更新使用者的登入次數與最後登入時間。

## 3. 前端核心解析: `admin.js`

`admin.js` 檔案包含了大量的後台管理邏輯，涵蓋了管理員操作的所有行為。其重要功能區塊如下：

### 3.1 Modal (彈跳視窗) 的實體強制控制
為了解決 Bootstrap Modal 與 Visual Studio Browser Link 衝突造成的卡死問題，實作了 `showModalSafely` 與 `hideModalSafely` 兩個防呆函式：
- 採用 **「物理強制開窗模式」**，在 Bootstrap API 失效時直接操作 DOM (如 `classList.add('show')`、手動生成黑罩等) 以確保視窗正常顯示與關閉。

### 3.2 廠區 (Fabs) 管理
- **函式包含:** `openAddFabModal()`, `editFab()`, `saveFabItem()`, `deleteFab()`。
- **功能:** 新增、編輯、刪除廠區代碼與名稱，並指派關聯的群組角色。異動後會觸發 `syncDataToDB()` 將資料背景同步。

### 3.3 角色/群組 (Roles) 管理
- **函式包含:** `openAddRoleModal()`, `editRole()`, `saveRoleItem()`, `deleteRole()`。
- **功能:** 管理群組權限，並支援指派可視的主選單 (`allowedMenuIds`)。
- **拖曳排序:** 實作了 `rmDragStart`, `rmDragOver`, `rmDrop` 等原生 Drag & Drop 事件，允許使用者透過拖曳改變選單在群組中的順序。

### 3.4 帳號 (Accounts) 管理
- **函式包含:** `openAddAccountModal()`, `editAccount()`, `saveAccountItem()`, `deleteAccount()` 等。
- **功能:** 建立與維護使用者帳號 (工號、部門、名稱)。
- **權限分級:** 區分系統管理員 (admin) 與一般用戶 (user)，支援針對特定使用者進行「委派權限 (Delegation)」，允許一般用戶也能管理特定的子選單。

### 3.5 選單 (Menus) 與看版 (Webpages) 節點樹管理
系統實作了高度客製化的樹狀結構與頁面綁定：
- **Webpage:** 提供 `openAddWebpageModal` 等函式，用來新增一個 `iframe` 連結或系統自訂畫面。
- **Tree Builder:** 透過 `tbAddFolder`, `tbAddLink`, `buildTreeUI` 構建巢狀樹狀編輯器，同樣搭配了 HTML5 的 Drag & Drop 功能，讓管理員可以隨意把「看版」拖曳放入不同「資料夾 (群組)」底下。

### 3.6 個人化設定 (Personal Menus)
- **函式包含:** `editPersonalMenu()`, `savePersonalMenu()`, `restoreDefaultPersonalMenu()`。
- **功能:** 允許使用者隱藏部分選單、修改自訂 Icon 或變更開啟行為，資料會寫入 LocalStorage 與資料庫的 `PersonalSettings`。

## 4. 總結

`EQDashboard` 是一套前端負擔較重的 Single Page Application (SPA)，透過一次性載入大量資料至前端 `window.appState`，並由 `js/*.js` (尤以 `admin.js`、`render.js` 為核心) 進行操作、篩選與渲染。任何 CRUD 修改都會直接呼叫 `syncDataToDB()` 與 `SettingsController.cs` 進行背景非同步保存，達成流暢且不需刷新頁面的使用者體驗。
