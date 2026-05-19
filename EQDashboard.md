# EQ Performance Dashboard - MVC + Web API 開發與整合標準作業程序 (SOP)

## 1. 系統架構與專案概述 (Architecture Overview)
系統採用「前後端分離處理」的資料架構：
* **前端 (Client-Side):** 以 MVC 的 Razor View (`.cshtml`) 作為網頁載體，搭配 Bootstrap 5 與 jQuery/Vanilla JS 負責 UI 互動。
* **後端 (Server-Side):** 透過 **Web API** 處理所有的業務邏輯與資料驗證。
* **資料庫 (Database):** 採用 **MSSQL**
* **資料傳輸:** 前端與後端之間統一使用 **AJAX (JSON 格式)** 進行非同步溝通。

---

## 2. Sync to DB 策略
「設定檔管理 (Excel 匯入)」頁面，為「資料庫同步 (Sync to DB)」模式。
* **【載入最新設定 (Load from DB)】:** 前端呼叫Web API。後端從 MSSQL 撈取最新架構，包裝成 JSON 回傳給前端重新渲染畫面。
* **【發佈並同步至資料庫 (Sync to DB)】:** 前端將修改過的設定檔組成完整 JSON，呼叫 Web API 寫入 MSSQL。

---

## 3. 圖片儲存(Icon 處理)
* **實體檔案上傳:** 建立 API (`POST /api/Upload/Icon`)。前端使用 `FormData` 上傳，後端儲存至 `wwwroot/uploads/icons/`，並將相對路徑字串存入 MSSQL (`IconPath` 欄位)。

---

## 4. 子系統與 Iframe 整合規範
* **無邊界設計 (Borderless):** 被嵌入的子系統網頁**禁止**包含本身的 Navbar 與 Sidebar。畫面須具備 RWD。
* **參數傳遞:** 主系統透過 QueryString (`?fab=12A`) 傳遞環境參數，子系統需能正確解析。
* **跨網域通訊 (CORS):** 若需呼叫主系統 API，後端需設定 AllowOrigins。若有 Session 過期，子系統需透過 `window.postMessage` 通知主框架登出。

---

## 5. 各頁面功能與實作細節規範 (Page-by-Page Requirements)

### 5.1 全域導覽列與基礎 UI 互動
* **登入機制與預設路由:** 整合 AD/LDAP 或 JWT。登入後，後端讀取 `User_DefaultPages`。若無指定，自動抓取使用者權限下**第一個可視的看板網頁**並載入。
* **動態麵包屑 (Breadcrumbs):** 前端需動態組合「父節點 > 子節點」路徑。
* **全螢幕沉浸模式:** 點擊 `target="_fullscreen"` 看板時，為 `body` 加上 `iframe-mode` 隱藏選單。
* **選單收合 / 廠區 / 語言 / 版面切換:** 支援即時 API 請求刷新架構與路由。
* **釘選與鎖定 (Pin & Auto-Hide):** 預設隱藏選單，透過邊緣感應區 (Edge Triggers) 觸發顯示。

### 5.2 個人頁面管理 (Personal Workspace)
* **顯示/隱藏 / 拖曳排序:** 呼叫 API 寫入 `User_PersonalSettings`。拖曳後前端重新計算索引 (0, 10, 20...) 批次更新。
* **圖示挑選邏輯:** 支援 FontAwesome 類別與實體圖片上傳。後端統一存入字串，前端負責判斷渲染方式 (`<img>` 或 `<i>`)。

### 5.3 看板網頁管理 (Webpage Management)
* **看板註冊中心:** 建立獨立網頁池 (Pool Items)，支援 Link 與 AppGrid 模式。支援全域排序與系統層級的啟用/停用。

### 5.4 選單配置管理 (Menu Node Management)
* **權限控管:** Admin 編輯全部，委派 User 編輯授權目錄。
* **節點綁定 (Tree Builder):** 下拉選單必須撈取「看板網頁管理」的實體清單。儲存時送出 JSON 結構，後端開啟 Transaction 覆寫父子關係與排序。

### 5.5 廠區與權限群組管理 (Fab & Role Management)
* **廠區管理:** 建立廠區，並綁定預設基礎權限群組。
* **群組權限配置:** 勾選看板並拖曳排序後，寫入 `Map_Role_Menu`。

### 5.6 帳號與委派管理 (Account Management)
* **Offcanvas 抽屜與即時搜尋:** 設定預設首頁時，前端須實作 Drawer 內的即時搜尋過濾 (Live Search) 功能。
* **委派管理:** 賦予 User 修改特定目錄結構的權限 (`Map_User_ManageMenu`)。

### 5.7 需求申請與審核 (ITSM - Apply & Audit)
* **需求申請:** User 寫入 `Requests`，狀態預設 `pending`。
* **審核管理:** Admin 回覆並變更狀態 (Processing, Resolved, Rejected)，前台即時同步。

### 5.8 應用集合模組 (App Grid)
* **App 項目管理:** 紀錄所屬 `MenuId`。
* **權限控管:** 僅 Admin 或受委派 User 可看見新增/編輯/刪除按鈕。

