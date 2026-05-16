// === 資料庫 / LocalStorage 鍵值常數 (已棄用 LocalStorage，僅留作常數參考) ===
const DB_MENUS = 'umc_menus_v1';
const DB_FABS = 'umc_fabs_v1';
const DB_ROLES = 'umc_roles_v1';
const DB_ACCTS = 'umc_accs_v1';
const DB_REQS = 'umc_reqs_v1';
const DB_APPS = 'umc_app_items_v1';

// === 系統全域變數 ===
let currentUser = null;
let currentLang = 'zh';

// ⭐️ 崩潰點修復：預設廠區必須對應資料庫中的 FabId，不能寫中文或顯示名稱
let currentFab = 'fab_12a';

let currentLayoutMode = 'system';
let currentAppGridMenuId = null;
let modals = {};
let confirmActionCallback = null;

// 拖曳相關變數
let dragSrcEl = null; let dragSrcId = null; let dragSrcParentId = null; let draggedRoleItem = null;

let systemAlertModalObj = null;
let systemConfirmModalObj = null;
let currentTreeData = [];
let expandedPerMenuIds = new Set();
let isPerAllExpanded = false;
let dtInstances = {};

// UI 狀態控制
window.currentActiveTopMenuId = null;
window.currentActiveSidebarMenuId = null;
let isPinned = true; // 預設固定版面
let tempDefaultPages = {};
let hasUnsavedChanges = false; // ⭐️ 已全面連線資料庫，不再需要未儲存標記

// =========================================================================
// ⭐️ 終極資料讀取介面：全面接管舊有的 LocalStorage 函式，強制導向資料庫記憶體 (appState)
// =========================================================================
function getCustomMenus() { return window.appState ? (window.appState.menus || []) : []; }
function getFabs() { return window.appState ? (window.appState.fabs || []) : []; }
function getRoles() { return window.appState ? (window.appState.roles || []) : []; }
function getAccounts() { return window.appState ? (window.appState.accounts || []) : []; }
function getAppItems() { return window.appState ? (window.appState.apps || []) : []; }
function getRequests() { return window.appState ? (window.appState.requests || []) : []; }

// 個人化設定暫時保留 LocalStorage，因為這部分隨使用者設備變動較合理
function getPersonalSettings(empId) {
    try { return JSON.parse(localStorage.getItem('umc_personal_menus_' + empId)) || {}; }
    catch (e) { return {}; }
}
function savePersonalSettings(empId, data) {
    localStorage.setItem('umc_personal_menus_' + empId, JSON.stringify(data));
}