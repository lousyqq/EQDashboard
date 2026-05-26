# 專案記憶庫 (memory.md)

## 🏗️ 1. 系統核心與隱藏邏輯
- 系統 UI (如廠區切換、權限綁定) 高度依賴完整的資料表關聯 (如 `Map_Fab_Role`, `Map_Account_Role`)，缺一不可。

## 🐛 2. 踩坑與填坑紀錄
- 2026-05-26: `BatchImport` 僅實作 Accounts 時，會導致前端同步覆蓋 DB，遺失其他表資料。暫時還原為舊版 `SaveData` 以解決此問題。

## 🛤️ 3. 開發歷史與決策日誌
- 2026-05-26: 修復「廠區無資料」問題，將前端 api.js 的寫入端點暫時還原為 /Settings/SaveData，以確保 Excel 匯入的 13 張關聯表能完整寫入 DB。
- 2026-05-26: 修復「讀取後廠區仍無資料」問題。因為前端改為並發呼叫 `/api/accounts`, `/api/fabs` 等 REST API 時，遺漏了沒有實體對應的 Mapping Tables (如 `Map_Fab_Role`)。
- 2026-05-26: 修復 EF Core 模型與 DB Schema 不匹配問題。舊版 Schema 使用 NVARCHAR 字串 PK（如 FabId='fab_12a'），但 CoreModels.cs 原本使用 INT 自增 PK，導致寫入全部失敗。已對齊回 MSSQL_DB架構.sql。
- 2026-05-26: **關鍵決策** — 將 `fetchInitialDataFromDB` 完全還原為只呼叫 `/Settings/GetInitialData`。該端點使用 ADO.NET 直接讀取 DB 所有 13 張表，資料格式完全匹配前端解析邏輯。拆分 REST API (`/api/accounts` 等) 保留作為未來分頁查詢用途，不再用於初始載入。

## 🛠️ 4. 進行中與待辦事項
- [x] 修復 Excel 匯入後廠區無法顯示問題
- [x] 修復左側選單消失問題（還原 fetchInitialDataFromDB 為單一端點）
