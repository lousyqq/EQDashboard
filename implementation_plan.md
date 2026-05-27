# 🌐 多國語言 (i18n) 全面導入計畫

為了解決系統在切換語言（繁體中文、English、日本語）時，介面文字能完整同步的問題，並連動廠區預設語言，特擬定此實作計畫。

## 🎯 目標

1. 擴充全域 `i18n` 翻譯字典，涵蓋所有介面上的靜態文字（包含按鈕、表頭、標籤、提示訊息等）。
2. 全面更新 `index.html`，為所有需要翻譯的 HTML 標籤補上 `data-i18n="對應的鍵值"` 屬性。
3. 確保「廠區管理」的預設語言設定在切換廠區時，能順利觸發語言切換。
4. 排除自訂命名（如使用者自己新增的看板名稱、選單名稱），這些維持讀取資料庫設定。

> [!IMPORTANT]
> **使用者檢閱確認事項**
> 1. **資料表套件 (DataTables)** 預設帶有「搜尋 (Search)」、「顯示 N 筆 (Show N entries)」、「上一頁/下一頁 (Previous/Next)」等文字。是否也需要一併隨著語言切換？（若需要，這會牽涉到重新載入表格，難度稍高；若只需要翻譯我們自訂的「表頭 (Table Headers)」則相對簡單。本計畫預設會先處理**表頭**與**自訂介面**的翻譯）。
> 2. 下方的翻譯對照表為部分抽樣，若有專有名詞需要修改，請隨時提出。

---

## 🛠️ 預計修改檔案與範圍

### 1. `wwwroot/js/config.js` (翻譯字典擴充)
將原有的 `i18n` 物件大幅擴充。新增的 Key 將分類如下：
- **導航與通用區** (Nav & Common): 系統設定、意見箱、登出系統、登入、操作...
- **頁面標題區** (Page Titles): 個人頁面管理、廠區管理、帳號管理...
- **表格表頭** (Table Headers): 顯示名稱、層級、狀態、群組名稱、權限層級...
- **表單與 Modal 標籤** (Form Labels): 廠區 ID、圖示、網址、開啟方式...

**翻譯對照範例 (部分)**：
- 廠區管理：`zh: '廠區管理', en: 'Fab Management', ja: '工場管理'`
- 帳號管理：`zh: '帳號管理', en: 'Account Management', ja: 'アカウント管理'`
- 操作 (Table 欄位)：`zh: '操作', en: 'Actions', ja: '操作'`
- 新增 (按鈕)：`zh: '新增', en: 'Add', ja: '追加'`
- 儲存 (按鈕)：`zh: '儲存', en: 'Save', ja: '保存'`

### 2. `wwwroot/index.html` (UI 標籤綁定)
遍歷整份 HTML 檔案，尋找所有中文字串，並以 `<span data-i18n="...">...</span>` 包覆或直接加在父元素上。
例如：
```diff
- <th>顯示名稱</th>
+ <th data-i18n="th_display_name">顯示名稱</th>

- <button class="btn btn-primary">新增帳號</button>
+ <button class="btn btn-primary"><i class="fas fa-plus me-1"></i><span data-i18n="btn_add_account">新增帳號</span></button>
```

### 3. 廠區切換連動邏輯 (已內建，需驗證)
目前 `render.js` 中的 `switchFab` 函式已經有包含以下邏輯：
```javascript
const dLang = fabObj.defaultLang || fabObj.DefaultLang;
if (dLang && typeof changeLanguage === 'function') {
    changeLanguage(dLang);
}
```
我們會在更新 HTML 與 Config 後，實際登入並切換廠區，驗證此邏輯是否能完美刷新全站語言。

---

## 🚦 執行步驟

1. 取得您的同意後，我將開始編輯 `config.js` 寫入完整翻譯。
2. 逐一修改 `index.html` 綁定翻譯標籤。
3. 若需處理 DataTables 的多語系切換，則會進一步修改 `admin.js`。
4. 提供完成後的測試 Walkthrough。

請確認以上計畫，若無其他特殊要求（或對於 DataTables 的多語系有特別指示），即可回覆「**同意**」，我將立即開始實作！
