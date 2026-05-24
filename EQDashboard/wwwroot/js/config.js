// === 資料庫 / LocalStorage 鍵值常數 (已棄用 LocalStorage，僅留作常數參考) ===
const DB_MENUS = 'umc_menus_v1';
const DB_FABS = 'umc_fabs_v1';
const DB_ROLES = 'umc_roles_v1';
const DB_ACCTS = 'umc_accs_v1';
const DB_REQS = 'umc_reqs_v1';
const DB_APPS = 'umc_app_items_v1';

// === i18n 翻譯表 (從 TEST_20260429.html:2129-2145 移植) ===
const i18n = {
    zh: {
        menu_workspace: "個人工作區", menu_home: "首頁總覽", menu_reports: "系統看板", menu_settings: "系統設定", nav_title: "EQ Performance", role_label: "權限:", logout: "登出", welcome_title: "系統登入成功", my_role_title: "權限層級", fab_label: "廠區", current_fab_title: "目前廠區",
        menu_personal_manage: "個人頁面管理", menu_webpage_manage: "看板網頁管理", menu_menu_manage: "選單配置管理", menu_fab_manage: "廠區管理", menu_role_manage: "權限管理", menu_account_manage: "帳號管理", menu_audit_manage: "申請審核管理", menu_apply: "需求申請", menu_config_manage: "設定檔管理",
        dyn_m_eastest: "EASTEST", dyn_m_eqas: "EQAS 指標", dyn_m_ze: "ZE 強化防禦群組", dyn_m_ze_1: "MNOP", dyn_m_ze_2: "WL子群組", dyn_m_ze_2_1: "ScalingTEST", dyn_m_ze_2_2: "Non Scaling", dyn_m_ze_3: "BSL", dyn_m_fdc: "FDC 指標看板", dyn_m_12m: "12M EAS", dyn_m_app_test: "12A_Module"
    },
    en: {
        menu_workspace: "Workspace", menu_home: "Dashboard Home", menu_reports: "System Dashboards", menu_settings: "Settings", nav_title: "EQ Performance", role_label: "Role:", logout: "Logout", welcome_title: "Login Successful", my_role_title: "Access Level", fab_label: "Fab", current_fab_title: "Current Fab",
        menu_personal_manage: "Personal Pages", menu_webpage_manage: "Webpage Mgt", menu_menu_manage: "Menu Config", menu_fab_manage: "Fab Mgt", menu_role_manage: "Role Mgt", menu_account_manage: "Account Mgt", menu_audit_manage: "Audit Mgt", menu_apply: "Access Request", menu_config_manage: "Config Mgt",
        dyn_m_eastest: "EASTEST", dyn_m_eqas: "EQAS Metrics", dyn_m_ze: "ZE Defense Group", dyn_m_ze_1: "MNOP", dyn_m_ze_2: "WL Subgroup", dyn_m_ze_2_1: "ScalingTEST", dyn_m_ze_2_2: "Non Scaling", dyn_m_ze_3: "BSL", dyn_m_fdc: "FDC Metrics", dyn_m_12m: "12M EAS", dyn_m_app_test: "12A_Module"
    },
    ja: {
        menu_workspace: "ワークスペース", menu_home: "ホーム", menu_reports: "レポート", menu_settings: "設定", nav_title: "EQ Performance", role_label: "権限:", logout: "ログアウト", welcome_title: "ログイン成功", my_role_title: "権限レベル", fab_label: "工場", current_fab_title: "選択中の工場",
        menu_personal_manage: "個人ページ", menu_webpage_manage: "Webページ管理", menu_menu_manage: "メニュー構成", menu_fab_manage: "工場管理", menu_role_manage: "権限管理", menu_account_manage: "アカウント管理", menu_audit_manage: "承認管理", menu_apply: "権限申請", menu_config_manage: "設定管理",
        dyn_m_eastest: "EASTEST", dyn_m_eqas: "EQAS 指標", dyn_m_ze: "ZE 防御グループ", dyn_m_ze_1: "MNOP", dyn_m_ze_2: "WL サブグループ", dyn_m_ze_2_1: "ScalingTEST", dyn_m_ze_2_2: "Non Scaling", dyn_m_ze_3: "BSL", dyn_m_fdc: "FDC 指標", dyn_m_12m: "12M EAS", dyn_m_app_test: "12A_Module"
    }
};

// === 系統全域變數 ===
let currentUser = null;
let currentLang = 'zh';

// 對齊 TEST_20260429.html：currentFab 統一用 fabName（非 fabId），由 initDashboardUI 帶入第一個廠區
let currentFab = '';

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