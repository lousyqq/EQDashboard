# 系統架構檢測與清理報告

經過深度盤點目前專案的目錄與程式碼，目前的架構呈現**「雙軌並行 (Dual-track)」**的過渡狀態。這是因為我們為了相容舊版前端複雜的權限載入邏輯，同時又為未來大資料量鋪路而設計的。

以下是針對專案現況的完整檢測結果與清理建議：

## 🏗️ 1. 目前架構現況：雙軌並行

### A 軌：穩定運作的舊版模式 (ADO.NET)
* **核心檔案**：`SettingsController.cs`
* **現況**：目前前端 `api.js` 百分之百依賴這個控制器中的 `/Settings/GetInitialData` 與 `/Settings/SaveData` 進行資料讀寫。
* **優點**：完美相容前端的權限映射機制（Mapping Tables），且一次拿回所有資料供前端在記憶體中快速操作。
* **缺點**：未來資料若高達上萬筆，一次性載入（不分頁）與一次性存檔會導致效能瓶頸。

### B 軌：為未來大資料量準備的新架構 (EF Core)
* **核心檔案**：
  - `Data/AppDbContext.cs` (資料庫連線上下文)
  - `Models/CoreModels.cs` (實體模型)
  - `Controllers/AccountsController.cs` (新版分頁 API)
  - `Controllers/BaseControllers.cs` (新版各表 API)
  - `DTOs/` (資料傳輸物件)
* **現況**：這些檔案皆已建置完成，底層邏輯已經就緒。
* **優點**：支援分頁 (Pagination)、ORM 語法簡潔好維護、效能極佳。
* **缺點**：目前前端尚未撰寫配合「分頁查詢」的 UI 邏輯，因此這些 API 暫時處於「備用」狀態。

---

## 🗑️ 2. 可以直接移除的殘留 / 冗餘檔案

以下檔案在幾經架構調整與還原後，**確定已經用不到**，建議可以直接移除以保持專案乾淨：

### 🚨 建議刪除清單
1. **`Controllers/SystemController.cs`**
   * **原因**：這是我先前為了嘗試使用 EF Core 處理「匯入 Excel (Batch-Import)」而建立的控制器。但因為後來發現 `SettingsController.cs` 的 `SaveData` 處理關聯表更穩定，且前端已經改回呼叫 `SaveData`，因此這個控制器已經變成孤兒，沒有任何地方呼叫它。

2. **舊的獨立實體檔 (若之前未刪除乾淨)**
   * **檔案**：`Models/Account.cs` 與 `Models/Role.cs`
   * **原因**：稍早建置時發現這些類別與 `Models/CoreModels.cs` 衝突，雖然稍早我已經透過終端機幫您移除了，但若在您的 IDE 方案總管中還有看到殘留的黃色驚嘆號，請直接從專案中剔除。

---

## 🚀 3. 未來擴充與調整建議

為了確保未來應付「上萬筆帳號」且「好維護」，建議未來的開發藍圖如下：

### 建議階段一：前端分頁化 (Pagination)
* 目前左側選單的「權限管理 > 帳號管理」頁面，是將全部帳號抓到前端處理。
* 未來若資料量變大，應修改 `admin.js` 與 `render.js`，讓該頁面的表格在換頁時，去呼叫 **`GET /api/accounts?page=1&pageSize=50`**。
* 此時，我們準備好的 `AccountsController.cs` 就會正式派上用場。

### 建議階段二：重構 SettingsController
* 目前 `SettingsController.cs` 高達近 `28KB`，內部使用了大量過時的 `SqlConnection` 與 `SqlCommand` (ADO.NET)。
* 當前端的 CRUD 操作都陸續轉移到獨立的 REST API (`AccountsController`, `FabsController` 等) 後，我們就可以將 `SettingsController.cs` 內部厚重的 SQL 字串徹底移除，完全改用 EF Core (`_context`) 來取代。

---

**總結**：目前除了 `SystemController.cs` 可以安全刪除之外，其他的 EF Core 檔案 (A 軌與 B 軌) 都強烈建議保留，這是專案從「單體大陣列」邁向「大型分頁與微服務架構」的必經之路！
