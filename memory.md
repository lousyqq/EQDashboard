# 專案記憶庫 (memory.md)

> 現況快照與待辦（精簡版，2026-07-19 整理）。
> 開發規範與坑點 → `CLAUDE.md`（＝`AGENTS.md`）；目錄結構與模組職責 → `系統架構.md`；DB 結構快照與增量 SQL 歷史 → `DB_Table.md`（Changelog 只增不刪）。

---

## 1. 當前系統架構概況

- **主線**：`EQDashboard.V2.Web`（ASP.NET Core .NET 9 + ES Modules + Bootstrap 5/jQuery，全 CDN 無 bundler）；整合測試 `EQDashboard.V2.Web.Tests`（xUnit + WebApplicationFactory，8/8 通過）。
- **DB**：MSSQL `EQDashboardV2` @ `Sariel`（6GB RAM，禁 `SqlBulkCopy`）。無 EF Migrations，`SchemaBootstrap` 啟動時冪等自我修復 **19 張表**（實體 7＋關聯 10＋`UserActivityLogs`＋`DailyUserVisits`）與全部索引。
- **驗證 (`AuthSettings`)**：Kestrel + Negotiate 自動登入（無手動帳密 Tab）；三開關：`SimulatedAccount`（本地模擬）、`DefaultAdmins`（自動建立/升級 admin 防鎖死）、`OpenAccessMode`（開放瀏覽自動建帳、全站放行；關閉則嚴格限 DB 名單）。當帳號初次建立或不存在於 DB（包含 OpenAccessMode 或 DefaultAdmins 自動建帳）時，自動至 `[WEB].[dbo].[notes_person]` 以 `EMPNO` 比對補齊員工姓名 `NAME` 與部門 `DEPTNAME`。App Grid 管理權限隔離不分模式生效。
- **快取鏈**：`SettingsService` 雙層快取（Global 60s / Volatile 10s）＋ ETag（摻入 `empId`/`isAdmin`）；`InitialDataCacheInvalidator`（Singleton）集中清快取＋bump ETag，連動作廢 `visibleMenus:{ETag}:{empId}`；`CacheInvalidationInterceptor` 為 EF 寫入安全網（raw SQL 寫入仍須手動 Invalidate）。
- **scope-to-own**：`GetInitialData` 對帳號相關表（`Accounts`/`PersonalSettings`/`Map_Account_*`）只回登入者自身列；全帳號管理走 `/api/Accounts`（唯一 server-side 分頁 DataTable）；自身授權走 `/api/Auth/MyProfile`（no-store，與 GetInitialData 並行）。
- **稽核與流量統計**：`ActivityLoggingMiddleware` → `ActivityLogQueue`（Channel，滿載告警不丟棄）→ `ActivityLogProcessor` 批次寫 `UserActivityLogs`；登入統計時 `SettingsService.RecordDailyUserVisitAsync` 以 `UPDATE...IF @@ROWCOUNT=0 INSERT` 冪等 upsert `DailyUserVisits`；`AnalyticsController`（admin-only）提供 DAU/MAU KPI 與造訪明細，前端 `admin/traffic-stats.js`（`#page-traffic-stats`）。
- **圖示與 IIS 相容性**：base64 一律轉實體檔 `images/icons/{guid}.{ext}`（不帶開頭斜線以相容 IIS 虛擬目錄與子應用程式部署），DB 只存相對路徑，統一走 `IIconStorageService`；前端由 `window.resolveIconUrl` 自動相容新舊圖示路徑並加 `onerror` 降級。APP 圖示編輯支援即時卡片預覽與清除功能。
- **前端**：唯一進入點 `index.html` → `main.js`；狀態中心 `store.js`；版本碼 `?v=20260720b` 全站一致；i18n zh/en/ja 全量覆蓋；RWD 集中 `css/responsive.css` + `ui/layout.js`。

---

## 2. 目前待辦事項 (Active Tasks)

- [~] **本地 Git 版控收尾**：確認 `bin/`、`obj/`、`.vs/`、`App_Data/`、`appsettings.json` 不進版控並完成 commit，維持工作目錄乾淨。
- [ ] **DataProtection 金鑰輪換（安全優先）**：刪除歷史外洩之 `App_Data/keys/*`，重啟由系統自動重產新金鑰（現有 Sessions 失效）。
- [ ] **大型規模擴展評估（長期可選）**：看板/權限達數千筆規模時，評估 Category/Tags 檢索、側欄樹狀 Lazy Rendering 與分廠 on-demand 載入。

---

## 3. 文件同步規範（雙 AI 協同：Gemini + Claude）

每次修改完成前必自動執行：
1. 同步 `CLAUDE.md`（＝`AGENTS.md`）與本檔：寫入新規範、移除過時任務。
2. 檔案增刪/職責調整時同步 `系統架構.md`。
3. DB 架構異動時：更新 `DB_Table.md` 快照 → 於方案根目錄 `sql\` 產出冪等增量 `.sql` → 於 `DB_Table.md` Changelog **只增不刪**追加日期與檔名。
4. 回覆末尾註明 `*已自動更新 CLAUDE.md 與 memory.md*`（有 SQL 檔亦一併列出）。
