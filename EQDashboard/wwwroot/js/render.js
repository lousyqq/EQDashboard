// ====== DataTable 與畫面動態產生渲染引擎 ======

<<<<<<< HEAD
// ⭐️ 終極 ID 洗淨器
window.cleanId = function (id) {
    if (id == null) return '';
=======
// ⭐️ 終極 ID 洗淨器 (防止 null、undefined、空字串、"null" 以及「空白鍵」造成的比對災難)
window.cleanId = function (id) {
    if (id == null) return '';
    // 加入 \s 徹底去除所有的全形/半形空白與換行字元，完美防禦 Excel 輸入誤差！
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
    let s = String(id).replace(/[\s\[\]"']/g, '').toLowerCase();
    return s === 'null' ? '' : s;
};

window.isParentMatch = function (childPId, parentNode) {
    let cp = window.cleanId(childPId);
    if (!cp || !parentNode) return false;
    return cp === window.cleanId(parentNode.id) ||
        (parentNode.name && cp === window.cleanId(parentNode.name)) ||
        (parentNode.displayName && cp === window.cleanId(parentNode.displayName));
};

window.localIsMenuDescendant = function (folderId, targetId, allMenus) {
    let folderNode = allMenus.find(m => window.cleanId(m.id) === window.cleanId(folderId));
    if (!folderNode) return false;
    if (window.cleanId(folderId) === window.cleanId(targetId)) return true;
    let q = [folderNode];
    while (q.length > 0) {
        let curr = q.shift();
        let children = allMenus.filter(m => m.id !== curr.id && (window.isParentMatch(m.parentId, curr) || (m.parentIds || []).some(pid => window.isParentMatch(pid, curr))));
        for (let child of children) {
            if (window.cleanId(child.id) === window.cleanId(targetId)) return true;
            q.push(child);
        }
    }
    return false;
};

// ⭐️ 終極靜默器群組 (隱藏控制台惱人報錯)
const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.join(' ');
    if (msg.includes('toLowerCase') || msg.includes('browserLink') || msg.includes('isDataTable')) return;
    originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
    const msg = args.join(' ');
    if (msg.includes('DataTables') || msg.includes('無法摧毀資料表') || msg.includes('Tracking Prevention') || msg.includes('sandbox')) return;
    originalConsoleWarn.apply(console, args);
};

window.addEventListener('error', function (event) {
    const msg = event.message || ''; const src = event.filename || '';
    if (msg.includes('toLowerCase') || msg.includes('isDataTable') || src.includes('browserLink')) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
window.addEventListener('unhandledrejection', function (event) {
    const msg = event.reason ? (event.reason.message || event.reason.toString()) : '';
    if (msg.includes('toLowerCase') || msg.includes('browserLink')) event.preventDefault();
}, true);

// 防呆小幫手：安全摧毀 DataTable
function safeDestroyDataTable(tableId) {
    try {
        if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable('#' + tableId)) {
            $('#' + tableId).DataTable().destroy();
        }
    } catch (e) { }
}

function initDataTable(tableId, sortable = true) {
    setTimeout(() => {
        try {
            if (typeof $ === 'undefined' || !$.fn || !$.fn.DataTable) return;
            if ($.fn.DataTable.isDataTable('#' + tableId)) $('#' + tableId).DataTable().destroy();
            dtInstances[tableId] = $('#' + tableId).DataTable({
                language: {
                    "processing": "處理中...", "lengthMenu": "顯示 _MENU_ 筆", "zeroRecords": "沒有符合的結果",
                    "info": "顯示第 _START_ 至 _END_ 筆，共 _TOTAL_ 筆", "infoEmpty": "顯示第 0 至 0 筆，共 0 筆",
                    "infoFiltered": "(從 _MAX_ 筆結果過濾)", "search": "<i class='fas fa-search text-muted me-1'></i> 搜尋:",
                    "paginate": { "first": "首頁", "previous": "上一頁", "next": "下一頁", "last": "尾頁" }
                }, pageLength: 10, lengthMenu: [10, 25, 50, 100], ordering: sortable, order: [], autoWidth: false, stateSave: false
            });
        } catch (e) { }
    }, 50);
}

// == 左側側邊欄產生邏輯 ==
function renderSidebarMenus() {
    try {
        if (!currentUser) return;
        let rawMenus = getCustomMenus();
        if (!Array.isArray(rawMenus)) rawMenus = [];
        let menus = JSON.parse(JSON.stringify(rawMenus)).filter(m => m && window.cleanId(m.id) !== '');
        let pSets = currentLayoutMode === 'personal' ? getPersonalSettings(currentUser.id) : {};
        const cCurrentFab = window.cleanId(currentFab);
        const fabsList = getFabs();
        const currentFabObj = fabsList.find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === cCurrentFab);

        const fabRoleIds = currentFabObj ? (currentFabObj.assignedRoles || currentFabObj.AssignedRoles || []) : [];
        const userRoleIds = currentUser.assignedRoles || currentUser.AssignedRoles || [];
        const activeRoleIds = (currentUser.roleLevel === 'admin') ? fabRoleIds : fabRoleIds.filter(id => userRoleIds.some(uId => window.cleanId(uId) === window.cleanId(id)));

        const roles = getRoles();
        let initialMenuIds = [];
        activeRoleIds.forEach(roleId => {
            const role = roles.find(r => window.cleanId(r.id || r.RoleId || r.roleId) === window.cleanId(roleId));
            const allowed = role ? (role.allowedMenuIds || role.AllowedMenuIds || []) : [];
            if (allowed) initialMenuIds.push(...allowed);
        });

        let allowedSet = new Set(initialMenuIds.map(window.cleanId).filter(id => id !== ''));

        let added = true;
        while (added) {
            added = false;
            menus.forEach(m => {
                let cId = window.cleanId(m.id);
                if (!cId || allowedSet.has(cId)) return;
                let hasAllowedParent = menus.some(pNode => pNode.id !== m.id && allowedSet.has(window.cleanId(pNode.id)) && (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
                if (hasAllowedParent) { allowedSet.add(cId); added = true; }
            });
        }

        added = true;
        while (added) {
            added = false;
            menus.forEach(m => {
                let cId = window.cleanId(m.id);
                if (!cId || !allowedSet.has(cId)) return;
                menus.forEach(pNode => {
                    let pId = window.cleanId(pNode.id);
                    if (!allowedSet.has(pId) && pNode.id !== m.id) {
                        if (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))) {
                            allowedSet.add(pId); added = true;
                        }
                    }
                });
            });
        }

        if (currentLayoutMode === 'personal') {
            menus.forEach(m => {
                if (pSets[m.id]) {
                    if (pSets[m.id].hidden !== undefined) m.enabled = !pSets[m.id].hidden;
                    if (pSets[m.id].target !== undefined) m.target = pSets[m.id].target;
                    if (pSets[m.id].order !== undefined) m.order = pSets[m.id].order;
                }
            });
        }

        let validMenus = menus.filter(m => {
            let cId = window.cleanId(m.id);
            if (!cId || !allowedSet.has(cId)) return false;
            if (currentUser.roleLevel !== 'admin' && m.enabled === false) return false;
            return true;
        });

        if (validMenus.length === 0 && menus.length > 0 && currentUser.roleLevel === 'admin') validMenus = menus.filter(m => m && window.cleanId(m.id) !== '');
        menus = validMenus;

        // ⭐️ 核心修復：強制將「群組權限」決定的看板組合順序，覆寫回全域的看板順序中！
        // 這樣不僅導覽列會即時反映變化，當觸發 syncDataToDB 儲存至資料庫時，順序也會永久鎖定，不會再跳回原本的組合。
        if (currentLayoutMode === 'system') {
            let orderCounter = 10;
            // 去除重複的看板 ID，確保唯一性
            let uniqueInitIds = [...new Set(initialMenuIds.map(window.cleanId))];

            uniqueInitIds.forEach(mId => {
                // 更新本次渲染拷貝的順序
                let localM = menus.find(x => window.cleanId(x.id) === mId);
                if (localM) localM.order = orderCounter;

                // ⭐️ 同步更新記憶體資料庫的全域順序，保證儲存時能成功寫入 DB，徹底防跳回！
                if (window.appState && window.appState.menus) {
                    let globalM = window.appState.menus.find(x => window.cleanId(x.id) === mId);
                    if (globalM) globalM.order = orderCounter;
                }
                orderCounter += 10;
            });
        }

        menus.sort((a, b) => {
            if (currentLayoutMode === 'system') {
                let hasParentA = menus.some(pNode => pNode.id !== a.id && (window.isParentMatch(a.parentId, pNode) || (a.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
                let hasParentB = menus.some(pNode => pNode.id !== b.id && (window.isParentMatch(b.parentId, pNode) || (b.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));

                // 如果兩者都是最上層的導覽列看板，依照我們剛才賦予的最新 order 進行排序
                if (!hasParentA && !hasParentB) {
                    return (a.order || 9999) - (b.order || 9999);
                }
            }
            // 自訂模式或子選單，維持原有的全域 Order 排序
            return (a.order || 0) - (b.order || 0);
        });

        let rootMenus = menus.filter(m => {
            if (String(m.isPoolItem).toLowerCase() === 'true') return false;
            let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
            return !hasValidParent;
        });

        if (rootMenus.length === 0 && menus.length > 0) rootMenus = menus.slice(0, 5);
        if ((!window.currentActiveTopMenuId || window.currentActiveTopMenuId !== 'system_settings' && !rootMenus.find(m => window.cleanId(m.id) === window.cleanId(window.currentActiveTopMenuId))) && rootMenus.length > 0) {
            window.currentActiveTopMenuId = rootMenus[0].id;
        }

        let topLinksHtml = '';
        if (rootMenus && rootMenus.length > 0) {
            rootMenus.forEach(root => {
                if (root.id === 'system_settings') return;
                let dName = root.displayName || root.name || '未命名選單';
                if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + root.id] && !root.isEdited) dName = i18n[currentLang]['dyn_' + root.id];
                const isActive = window.cleanId(root.id) === window.cleanId(window.currentActiveTopMenuId) ? 'active' : '';
                topLinksHtml += `<a class="top-menu-link text-truncate ${isActive}" onclick="selectTopMenu('${root.id}')" title="${dName}">${dName}</a>`;
            });
        }
        const topMenusContainer = document.getElementById('top-dynamic-menus');
        if (topMenusContainer) topMenusContainer.innerHTML = topLinksHtml;

        const sysBtn = document.getElementById('btn-system-settings');
        if (sysBtn) {
            if (window.currentActiveTopMenuId === 'system_settings') sysBtn.classList.add('active');
            else sysBtn.classList.remove('active');
        }

        let html = '';
        const triggerLeft = document.getElementById('trigger-left');

        if (window.currentActiveTopMenuId === 'system_settings') {
            const titleEl = document.getElementById('sidebar-module-title');
            if (titleEl) titleEl.innerText = '系統設定';
            setTimeout(() => { if (triggerLeft) triggerLeft.style.display = 'block'; if (isPinned) document.body.classList.remove('sidebar-hidden'); }, 10);

            const role = currentUser.roleLevel;
            const canManage = role === 'admin' || (role === 'user' && currentUser.manageableMenus && currentUser.manageableMenus.length > 0);

            // ⭐️ 核心修復：根據目前的版面模式 (currentLayoutMode) 決定是否顯示「個人頁面管理」
            const sysMenus = [
                { id: 'page-personal-manage', icon: 'fas fa-user-cog', name: '個人頁面管理', display: currentLayoutMode === 'custom' || currentLayoutMode === 'personal' },
                { id: 'page-webpage-manage', icon: 'fas fa-file-code', name: '看板網頁管理', display: canManage },
                { id: 'page-menu-manage', icon: 'fas fa-sitemap', name: '選單配置管理', display: canManage },
                { id: 'page-fab-manage', icon: 'fas fa-building', name: '廠區管理', display: role === 'admin' },
                { id: 'page-role-manage', icon: 'fas fa-users-cog', name: '權限管理', display: role === 'admin' },
                { id: 'page-account-manage', icon: 'fas fa-user-shield', name: '帳號管理', display: role === 'admin' },
                { id: 'page-audit-manage', icon: 'fas fa-clipboard-check', name: '申請審核管理', display: role === 'admin' },
                { id: 'page-apply', icon: 'fas fa-paper-plane', name: '需求申請', display: role !== 'admin' },
                { id: 'page-config-manage', icon: 'fas fa-database', name: '資料庫與同步', display: role === 'admin' }
            ];
            sysMenus.forEach(sm => {
                if (sm.display) html += `<div class="menu-item" onclick="navTo('${sm.id}', this, '${sm.name}')"><i class="${sm.icon} menu-icon"></i> <span class="text-truncate">${sm.name}</span></div>`;
            });
        } else {
            const activeRoot = rootMenus.find(m => window.cleanId(m.id) === window.cleanId(window.currentActiveTopMenuId));
            if (activeRoot) {
                const titleEl = document.getElementById('sidebar-module-title');
                if (titleEl) titleEl.innerText = activeRoot.displayName || activeRoot.name || '未命名選單';
                const subMenus = menus.filter(m => m.id !== activeRoot.id && (window.isParentMatch(m.parentId, activeRoot) || (m.parentIds || []).some(pid => window.isParentMatch(pid, activeRoot))));

                if (subMenus.length === 0) {
                    setTimeout(() => { document.body.classList.add('sidebar-hidden'); if (triggerLeft) triggerLeft.style.display = 'none'; }, 10);
                } else {
                    setTimeout(() => { if (triggerLeft) triggerLeft.style.display = 'block'; if (isPinned) document.body.classList.remove('sidebar-hidden'); }, 10);
                }
                subMenus.sort((a, b) => (a.parentOrders?.[activeRoot.id] ?? a.order ?? 0) - (b.parentOrders?.[activeRoot.id] ?? b.order ?? 0));
<<<<<<< HEAD
=======

                // ⭐️ 確保呼叫時，forceExpand 預設為 true (全展開)
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
                subMenus.forEach(child => { html += generateSidebarMenuItem(child, menus, 1, true); });
            }
        }
        const sidebarContainer = document.getElementById('dynamic-sidebar-menus');
        if (sidebarContainer) sidebarContainer.innerHTML = html;

    } catch (err) { }
}

<<<<<<< HEAD
function generateSidebarMenuItem(menu, allMenus, level, forceExpand = true) {
=======
function generateSidebarMenuItem(menu, allMenus, level, forceExpand = true) { // ⭐️ 修正：預設值強制為 true，所有目錄預設全開！
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
    if (!menu || !menu.id) return '';
    const subMenus = allMenus.filter(m => m.id !== menu.id && (window.isParentMatch(m.parentId, menu) || (m.parentIds || []).some(pid => window.isParentMatch(pid, menu))));
    subMenus.sort((a, b) => (a.parentOrders?.[menu.id] ?? a.order ?? 0) - (b.parentOrders?.[menu.id] ?? b.order ?? 0));
    const hasChildren = subMenus.length > 0;
    let isDescendant = false;
    if (hasChildren && window.currentActiveSidebarMenuId && typeof window.localIsMenuDescendant === 'function') {
        isDescendant = window.localIsMenuDescendant(menu.id, window.currentActiveSidebarMenuId, allMenus);
    }
    const isExpanded = forceExpand || isDescendant; // 這裡將會是 true

    let iconClass = menu.icon || 'far fa-file-alt';
    if (menu.menuMode === 'folder' && !menu.icon) iconClass = 'fas fa-folder';
    let iconHtml = `<i class="${iconClass} menu-icon ${menu.menuMode === 'folder' ? 'text-warning' : ''}"></i>`;
    if (menu.icon && (menu.icon.startsWith('data:') || menu.icon.startsWith('icon/'))) {
        iconHtml = `<img src="${menu.icon}" class="custom-icon menu-icon" alt="icon">`;
    }

    const safeDomId = 'collapse_' + encodeURIComponent(String(menu.id)).replace(/%/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

    // ⭐️ 核心修正：棄用 Bootstrap 原生觸發器，改用完全自己掌控的 onclick，絕對不卡死！
    let actionAttr = '';
    if (hasChildren) actionAttr = `onclick="window.toggleSubMenu(event, '${safeDomId}', this)"`;
    else if (menu.menuMode === 'app_grid') actionAttr = `onclick="window.activateMenu('${menu.id}')"`;
    else if (menu.url) {
        if (menu.target === 'blank') actionAttr = `onclick="window.open('${menu.url}', '_blank')"`
        else actionAttr = `onclick="window.activateMenu('${menu.id}')"`;
    }
    else if (menu.targetPage) actionAttr = `onclick="window.activateMenu('${menu.id}')"`;

    let dName = menu.displayName || menu.name || '未命名選單';
    if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + menu.id] && !menu.isEdited) {
        dName = i18n[currentLang]['dyn_' + menu.id];
    }

    if (hasChildren) {
        const expClass = isExpanded ? 'show' : '';
        const ariaAttr = isExpanded ? 'true' : 'false';
        const collapsedClass = isExpanded ? '' : 'collapsed';
        let html = `<div class="menu-item ${collapsedClass}" ${actionAttr} title="${dName}" aria-expanded="${ariaAttr}" style="cursor:pointer;">
                        ${iconHtml}<span class="text-truncate">${dName}</span>
                        <i class="fas fa-chevron-right dropdown-arrow"></i>
                    </div>
                    <div class="collapse ${expClass}" id="${safeDomId}" style="${isExpanded ? 'display:block;' : 'display:none;'}">
                        <div class="sub-menu-container">`;
        subMenus.forEach(child => html += generateSidebarMenuItem(child, allMenus, level + 1, forceExpand));
        html += `</div></div>`;
        return html;
    } else {
        const itemClass = level > 1 ? 'menu-item sub-item' : 'menu-item';
        return `<div class="${itemClass}" ${actionAttr} title="${dName}" style="cursor:pointer;">${iconHtml}<span class="text-truncate">${dName}</span></div>`;
    }
}

<<<<<<< HEAD
window.toggleSubMenu = function (e, targetId, element) {
    e.preventDefault(); e.stopPropagation();
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    const isShowing = targetEl.classList.contains('show');
    if (isShowing) {
        targetEl.classList.remove('show'); targetEl.style.display = 'none';
        element.classList.add('collapsed'); element.setAttribute('aria-expanded', 'false');
    } else {
        targetEl.classList.add('show'); targetEl.style.display = 'block';
        element.classList.remove('collapsed'); element.setAttribute('aria-expanded', 'true');
    }
};

=======
// ⭐️ 新增：物理展開/收合控制器 (保證 100% 絕對能開能關，不受外部套件干擾)
window.toggleSubMenu = function (e, targetId, element) {
    e.preventDefault();
    e.stopPropagation();
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    // 不依賴 Bootstrap，直接暴力操作 DOM
    const isShowing = targetEl.classList.contains('show');
    if (isShowing) {
        // 執行手動收合
        targetEl.classList.remove('show');
        targetEl.style.display = 'none';
        element.classList.add('collapsed');
        element.setAttribute('aria-expanded', 'false');
    } else {
        // 執行手動展開
        targetEl.classList.add('show');
        targetEl.style.display = 'block';
        element.classList.remove('collapsed');
        element.setAttribute('aria-expanded', 'true');
    }
};

// == 首頁儀表板資料 ==
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
function renderHomeDashboard() {
    try {
        if (!currentUser) return;
        const nameEl = document.getElementById('user-name'); if (nameEl) nameEl.innerText = currentUser.id;
        const roleEl = document.getElementById('user-role');
        const loginCount = currentUser.loginCount || 1;
        if (roleEl) roleEl.innerHTML = `這是您第 <span style="color: #38bdf8; font-weight: 800; font-size: 0.75rem;">${loginCount}</span> 次登入`;

        const dropName = document.getElementById('dropdown-user-name'); if (dropName) dropName.innerText = `${currentUser.name} (${currentUser.id})`;
        const dropDept = document.getElementById('dropdown-user-dept'); if (dropDept) dropDept.innerText = currentUser.department || '未設定部門';
        const dropCount = document.getElementById('dropdown-user-login-count'); if (dropCount) dropCount.innerText = `${currentUser.loginCount || 1} 次`;
        const dropTime = document.getElementById('dropdown-user-login-time'); if (dropTime) dropTime.innerText = currentUser.currentLoginTime || '00:00 AM';

        let displayDName = currentFab;
        const fabsList = getFabs();
        const currentFabObj = fabsList.find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(currentFab));
        if (currentFabObj) displayDName = currentFabObj.displayName || currentFabObj.DisplayName || currentFabObj.fabName || currentFabObj.FabName || currentFab;

        const currentFabEl = document.getElementById('current-fab-name'); if (currentFabEl) currentFabEl.innerText = displayDName || '未選擇';
        const homeRole = document.getElementById('home-role-title'); const homeRoleLvl = document.getElementById('home-role-level');
        if (homeRole) homeRole.innerText = currentUser.roleLevel === 'admin' ? '系統管理員' : '一般使用者';
        if (homeRoleLvl) homeRoleLvl.innerText = currentUser.roleLevel === 'admin' ? '(Admin)' : '(User)';
        const homeFab = document.getElementById('home-fab-display'); if (homeFab) homeFab.innerText = displayDName;
    } catch (e) { }
}

function renderFabSwitcher() {
    try {
        const fabs = getFabs(); const container = document.getElementById('fab-dropdown-menu');
        if (container) {
            container.innerHTML = fabs.map(f => {
                const fName = f.fabName || f.FabName || f.id || f.fabId || f.FabId || '未命名廠區';
                const dName = f.displayName || f.DisplayName || fName;
                const isActive = window.cleanId(currentFab) === window.cleanId(fName);
                return `<li><a class="dropdown-item py-1 fw-bold cursor-pointer d-flex justify-content-between align-items-center ${isActive ? 'active bg-light text-primary' : ''}" onclick="switchFab('${fName}')">${dName} ${isActive ? '<i class="fas fa-check"></i>' : ''}</a></li>`;
            }).join('');
        }
        const currentFabObj = fabs.find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(currentFab));
        let displayDName = currentFab;
        if (currentFabObj) displayDName = currentFabObj.displayName || currentFabObj.DisplayName || currentFabObj.fabName || currentFabObj.FabName || currentFab;

        const displayEl = document.getElementById('current-fab-display');
        if (displayEl) displayEl.innerText = displayDName;
        if (container && container.previousElementSibling && container.previousElementSibling.classList.contains('dropdown-toggle')) {
            const toggleSpan = container.previousElementSibling.querySelector('span');
            if (toggleSpan && toggleSpan !== displayEl) toggleSpan.innerText = displayDName;
        }
    } catch (e) { console.error("renderFabSwitcher 錯誤:", e); }
}

function switchFab(fabName) {
    currentFab = fabName;
    const fabObj = getFabs().find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(fabName));
    if (fabObj) { const dLang = fabObj.defaultLang || fabObj.DefaultLang; if (dLang) changeLanguage(dLang); }
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
    goDefaultHome();
}

function renderPersonalMenuManage() {
    const container = document.getElementById('personalMenuManageContainer'); if (!container) return;
    if (!currentUser) { container.innerHTML = '<div class="alert alert-warning">請先登入</div>'; return; }

    const fabs = getFabs(); const roles = getRoles(); const menus = getCustomMenus();
    const userRoles = currentUser.assignedRoles || currentUser.AssignedRoles || [];

    window.tempDefaultPages = window.tempDefaultPages || Object.assign({}, currentUser.defaultPages || {});
    window.tempHiddenRoles = window.tempHiddenRoles || [];

    let html = `<h5 class="fw-bold"><i class="fas fa-industry text-primary me-2"></i>第一步：選擇預設顯示廠區</h5><div class="card mb-4 border-0 shadow-sm"><div class="card-body"><div class="d-flex flex-wrap gap-4">`;
    let globalDefaultFab = window.tempDefaultPages['global'] || currentUser.defaultPage || (fabs.length > 0 ? window.cleanId(fabs[0].id || fabs[0].FabId || fabs[0].fabId) : '');

    fabs.forEach(fab => {
        let fId = window.cleanId(fab.id || fab.FabId || fab.fabId);
        let fName = fab.displayName || fab.DisplayName || fab.fabName || fab.FabName;
        let isChecked = (globalDefaultFab === fId) ? 'checked' : '';
        html += `<div class="form-check"><input class="form-check-input" type="radio" name="global_def_fab" id="g_def_fab_${fId}" value="${fId}" ${isChecked} onchange="window.tempDefaultPages['global'] = this.value;"><label class="form-check-label fw-bold" style="cursor:pointer;" for="g_def_fab_${fId}">${fName}</label></div>`;
    });
    html += `</div></div></div>`;

    html += `<h5 class="mt-4 fw-bold"><i class="fas fa-layer-group text-primary me-2"></i>第二步：選擇可視的群組版面</h5><div class="card mb-4 border-0 shadow-sm"><div class="card-body"><div class="d-flex flex-wrap gap-4">`;
    userRoles.forEach(roleId => {
        let rId = window.cleanId(roleId);
        let roleObj = roles.find(r => window.cleanId(r.id || r.RoleId || r.roleId) === rId);
        let rName = roleObj ? (roleObj.groupName || roleObj.GroupName || roleObj.name) : roleId;
        let isChecked = !window.tempHiddenRoles.includes(rId) ? 'checked' : '';
        html += `<div class="form-check form-switch fs-6"><input class="form-check-input role-visibility-cb" type="checkbox" id="vis_role_${rId}" value="${rId}" ${isChecked} onchange="toggleRoleVisibility('${rId}')"><label class="form-check-label fw-bold" style="cursor:pointer;" for="vis_role_${rId}">${rName}</label></div>`;
    });
    html += `</div></div></div>`;

    html += `<h5 class="mt-4 fw-bold"><i class="fas fa-list-check text-primary me-2"></i>第三步：設定各廠區預設首頁與選單顯示 (可拖曳排序)</h5><div class="card border-0 shadow-sm"><div class="card-body"><ul class="nav nav-tabs mb-3" id="personalFabTabs" role="tablist">`;
    let firstFab = true;
    fabs.forEach(fab => {
        let fId = window.cleanId(fab.id || fab.FabId || fab.fabId);
        let fName = fab.displayName || fab.DisplayName || fab.fabName || fab.FabName;
        html += `<li class="nav-item" role="presentation"><button class="nav-link ${firstFab ? 'active' : ''} fw-bold" id="tab-${fId}" data-bs-toggle="tab" data-bs-target="#pane-${fId}" type="button" role="tab">${fName}</button></li>`;
        firstFab = false;
    });
    html += `</ul><div class="tab-content" id="personalFabTabsContent">`;
    firstFab = true;

    fabs.forEach(fab => {
        let fId = window.cleanId(fab.id || fab.FabId || fab.fabId);
        html += `<div class="tab-pane fade ${firstFab ? 'show active' : ''}" id="pane-${fId}" role="tabpanel"><div class="list-group sortable-personal-menu-list" data-fab="${fId}">`;

        let allowedMenuIds = new Set();
        userRoles.forEach(roleId => {
            let rId = window.cleanId(roleId);
            if (window.tempHiddenRoles.includes(rId)) return;
            let roleObj = roles.find(r => window.cleanId(r.id || r.RoleId || r.roleId) === rId);
            if (roleObj) {
                let mList = roleObj.menus || roleObj.Menus || roleObj.allowedMenuIds || [];
                mList.forEach(m => allowedMenuIds.add(window.cleanId(m)));
            }
        });

        let personalHidden = currentUser.hiddenMenus || currentUser.HiddenMenus || [];
        if (typeof personalHidden === 'string') personalHidden = personalHidden.split(',');
        personalHidden = personalHidden.map(window.cleanId);

        let personalSort = currentUser.menuSortOrder || currentUser.MenuSortOrder || {};
        let currentFabSort = personalSort[fId] || [];

        let fabMenus = menus.filter(m => {
            let mId = window.cleanId(m.id || m.MenuId || m.menuId);
            let mode = (m.menuMode || m.MenuMode || '').toLowerCase();
            return allowedMenuIds.has(mId) && mode !== 'folder';
        });

        fabMenus.sort((a, b) => {
            let aId = window.cleanId(a.id || a.MenuId || a.menuId);
            let bId = window.cleanId(b.id || b.MenuId || b.menuId);
            let idxA = currentFabSort.indexOf(aId); let idxB = currentFabSort.indexOf(bId);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1; if (idxB !== -1) return 1; return 0;
        });

        if (fabMenus.length === 0) {
            html += `<div class="text-muted p-3 text-center"><i class="fas fa-info-circle me-2"></i>此廠區/群組下無可顯示的選單</div>`;
        } else {
            let defPage = window.tempDefaultPages[fId] || '';
            if (!defPage && fabMenus.length > 0) {
                let firstVisible = fabMenus.find(m => !personalHidden.includes(window.cleanId(m.id || m.MenuId || m.menuId)));
                defPage = firstVisible ? window.cleanId(firstVisible.id || firstVisible.MenuId || firstVisible.menuId) : '';
            }

            fabMenus.forEach(m => {
                let mId = window.cleanId(m.id || m.MenuId || m.menuId);
                let mName = m.displayName || m.DisplayName || m.sysName || m.SysName;
                let isHidden = personalHidden.includes(mId);
                let isChecked = !isHidden ? 'checked' : '';
                let isDefault = (defPage === mId) ? 'checked' : '';

                html += `
                    <div class="list-group-item d-flex align-items-center justify-content-between personal-menu-item" data-id="${mId}">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-grip-vertical text-muted me-3 drag-handle" style="cursor: grab; font-size: 1.2rem;"></i>
                            <span class="fw-bold text-dark">${mName}</span>
                        </div>
                        <div class="d-flex align-items-center gap-4">
                            <div class="form-check mb-0">
                                <input class="form-check-input def-page-radio" type="radio" name="def_page_${fId}" id="def_${fId}_${mId}" value="${mId}" ${isDefault} onchange="window.tempDefaultPages['${fId}'] = this.value;">
                                <label class="form-check-label text-secondary" style="cursor:pointer;" for="def_${fId}_${mId}">預設首頁</label>
                            </div>
                            <div class="form-check form-switch mb-0">
                                <input class="form-check-input vis-switch" type="checkbox" id="vis_${fId}_${mId}" ${isChecked}>
                                <label class="form-check-label text-secondary" style="cursor:pointer;" for="vis_${fId}_${mId}">顯示</label>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div></div>`;
        firstFab = false;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;

    if (typeof Sortable !== 'undefined') {
        document.querySelectorAll('.sortable-personal-menu-list').forEach(el => {
            new Sortable(el, { handle: '.drag-handle', animation: 150, ghostClass: 'bg-light' });
        });
    }
}

window.toggleRoleVisibility = function (roleId) {
    window.tempHiddenRoles = window.tempHiddenRoles || [];
    const cb = document.getElementById(`vis_role_${roleId}`);
    if (cb && !cb.checked) { if (!window.tempHiddenRoles.includes(roleId)) window.tempHiddenRoles.push(roleId); }
    else { window.tempHiddenRoles = window.tempHiddenRoles.filter(id => id !== roleId); }
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
};

function renderFabTable() {
    safeDestroyDataTable('dtFab'); const tbody = document.getElementById('fabTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const fabs = getFabs(); const roles = getRoles();
    fabs.forEach(f => {
        const fId = f.id || f.fabId || f.FabId || ''; const fName = f.fabName || f.FabName || fId;
        const dName = f.displayName || f.DisplayName || fName; const dLang = f.defaultLang || f.DefaultLang || 'zh';
        const aRoles = f.assignedRoles || f.AssignedRoles || [];
        let roleBadges = (aRoles).map(rId => {
            let r = roles.find(x => window.cleanId(x.id || x.roleId || x.RoleId) === window.cleanId(rId));
            let rName = r ? (r.groupName || r.GroupName || rId) : rId;
            return r ? `<span class="badge badge-flat-list me-1">${rName}</span>` : '';
        }).join('');
        if (!roleBadges) roleBadges = '<span class="text-muted small">未綁定</span>';

        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2"><button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editFab('${fId}');" title="編輯"><i class="fas fa-edit"></i></button><button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteFab('${fId}')" title="刪除"><i class="fas fa-trash-alt"></i></button></div>`;
        tbody.innerHTML += `<tr><td class="text-start ps-3 fw-bold align-middle">${fName}</td><td class="align-middle">${dName}</td><td class="align-middle">${dLang === 'en' ? 'English' : (dLang === 'ja' ? '日本語' : '繁體中文')}</td><td class="text-start align-middle">${roleBadges}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtFab');
}

function renderRoleTable() {
    safeDestroyDataTable('dtRole'); const tbody = document.getElementById('roleTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const roles = getRoles(); const menus = getCustomMenus();
    roles.forEach(r => {
        let menuBadges = (r.allowedMenuIds || r.AllowedMenuIds || []).map(mId => {
            let m = menus.find(x => window.cleanId(x.id || x.MenuId || x.menuId) === window.cleanId(mId));
            let mName = m ? (m.displayName || m.DisplayName || mId) : mId;
            return m ? `<span class="badge badge-flat-list me-1 mb-1">${mName}</span>` : '';
        }).join('');
        if (!menuBadges) menuBadges = '<span class="text-muted small">無綁定看板</span>';
        const rId = r.id || r.roleId || r.RoleId || ''; const rName = r.groupName || r.GroupName || rId;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2"><button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editRole('${rId}');" title="編輯"><i class="fas fa-edit"></i></button><button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteRole('${rId}')" title="刪除"><i class="fas fa-trash-alt"></i></button></div>`;
        tbody.innerHTML += `<tr><td class="text-start ps-3 fw-bold text-primary align-middle">${rName}</td><td class="text-start align-middle" style="max-width: 400px; white-space: normal;">${menuBadges}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtRole');
}

function renderAccountTable() {
    safeDestroyDataTable('dtAccount'); const tbody = document.getElementById('accTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const accs = getAccounts(); const roles = getRoles(); const menus = getCustomMenus();
    accs.forEach(a => {
        const aRoles = a.assignedRoles || a.AssignedRoles || [];
        let roleBadges = aRoles.map(rId => { let r = roles.find(x => window.cleanId(x.id || x.RoleId) === window.cleanId(rId)); return r ? `<span class="badge badge-flat-list me-1 mb-1">${r.groupName || r.GroupName}</span>` : ''; }).join('');
        if (!roleBadges) roleBadges = '<span class="text-muted small">無個人版面群組</span>';

        const aLevel = a.roleLevel || a.RoleLevel || '';
        const lvlBadge = aLevel === 'admin' ? '<span class="badge bg-danger">Admin</span>' : '<span class="badge bg-secondary">User</span>';

        const dPages = a.defaultPages || a.DefaultPages || {};
        let defPagesHtml = '';
        if (Object.keys(dPages).length > 0) {
            for (let fab in dPages) {
                let m = menus.find(x => window.cleanId(x.id || x.MenuId) === window.cleanId(dPages[fab]));
                let pathStr = m ? getFullMenuPathStr(m.id || m.MenuId, menus) : '找不到看板';
                defPagesHtml += `<div class="small mb-1"><span class="badge bg-secondary me-1" style="width:40px;">${fab}</span><span class="text-success fw-bold">${pathStr}</span></div>`;
            }
        } else { defPagesHtml = '<span class="text-muted small">未設定 (自動抓取第一個)</span>'; }

        const aId = a.empId || a.EmpId || ''; const aName = a.name || a.Name || ''; const aDept = a.department || a.Department || '';
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2"><button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editAccount('${aId}');" title="編輯"><i class="fas fa-edit"></i></button><button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteAccount('${aId}')" title="刪除"><i class="fas fa-trash-alt"></i></button></div>`;
        tbody.innerHTML += `<tr><td class="fw-bold align-middle">${aId}</td><td class="align-middle"><div class="fw-bold text-dark">${aName}</div><div class="small text-muted">${aDept}</div></td><td class="align-middle">${lvlBadge}</td><td class="text-start align-middle">${defPagesHtml}</td><td class="text-start align-middle" style="white-space: normal;">${roleBadges}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtAccount');
}

function renderWebpageTable() {
    safeDestroyDataTable('dtWebpage'); const tbody = document.getElementById('webpageTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const menus = getCustomMenus().filter(m => String(m.menuMode || m.MenuMode).toLowerCase() !== 'folder' && String(m.isPoolItem || m.IsPoolItem).toLowerCase() !== 'true');
    menus.forEach(m => {
        const mEnabled = m.enabled !== undefined ? m.enabled : (m.IsEnabled !== undefined ? m.IsEnabled : true);
        const mMode = m.menuMode || m.MenuMode; const mTarget = m.target || m.OpenTarget;
        const mUrl = m.url || m.Url || m.targetPage || m.TargetPage || '#';
        const mIcon = m.icon || m.Icon; const mId = m.id || m.MenuId;
        const mDName = m.displayName || m.DisplayName; const mSysName = m.name || m.SysName;

        let statusBadge = mEnabled ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>';
        let typeBadge = mMode === 'app_grid' ? '<span class="badge bg-info text-dark border"><i class="fas fa-th-large"></i> 應用集合</span>' : '<span class="badge bg-light text-dark border"><i class="fas fa-link"></i> 網頁連結</span>';
        let targetTxt = mTarget === 'iframe' ? '嵌入網頁' : (mTarget === 'fullscreen' ? '全螢幕' : '另開分頁');
        let linkTxt = mMode === 'app_grid' ? '<span class="text-muted small">內部元件</span>' : `<a href="${mUrl}" target="_blank" class="small text-truncate d-inline-block" style="max-width:200px;">${mUrl}</a>`;
        let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(mIcon, 'text-primary', 'me-2') : '';

        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2"><button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); openAddWebpageModal('${mId}');" title="編輯"><i class="fas fa-edit"></i></button><button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteWebpageItem('${mId}')" title="刪除"><i class="fas fa-trash-alt"></i></button></div>`;
        tbody.innerHTML += `<tr class="draggable-row" draggable="true" ondragstart="handleDragStart(event, '${mId}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${mId}', null, 'webpage')"><td class="text-start ps-3 fw-bold text-dark align-middle"><i class="fas fa-grip-vertical text-muted me-2 opacity-50"></i>${iconHtml} ${mDName} <br><small class="text-muted fw-normal ms-4">${mSysName}</small></td><td class="align-middle">${typeBadge}</td><td class="align-middle">${statusBadge}</td><td class="text-start align-middle"><span class="badge bg-secondary me-1">${targetTxt}</span> ${linkTxt}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtWebpage', false);
}

function renderMenuConfigTable() {
    safeDestroyDataTable('dtMenuConfig'); const tbody = document.getElementById('menuConfigTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const menus = getCustomMenus();
    const roots = menus.filter(m => {
        if (String(m.isPoolItem || m.IsPoolItem).toLowerCase() === 'true') return false;
        let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId || m.ParentMenuId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
        return !hasValidParent;
    });
    roots.sort((a, b) => (a.order || a.GlobalOrder || a.SortOrder || 0) - (b.order || b.GlobalOrder || b.SortOrder || 0));

    function getDescendantBadges(parentId, allMenus) {
        let badges = '';
        let children = allMenus.filter(x => x.id !== parentId && (window.isParentMatch(x.parentId || x.ParentMenuId, { id: parentId }) || (x.parentIds || []).some(pid => window.isParentMatch(pid, { id: parentId }))));
        children.sort((a, b) => (a.parentOrders?.[parentId] ?? a.order ?? a.GlobalOrder ?? 0) - (b.parentOrders?.[parentId] ?? b.order ?? b.GlobalOrder ?? 0));
        children.forEach(child => {
            let isFolder = (child.menuMode || child.MenuMode) === 'folder';
            let icon = isFolder ? '<i class="fas fa-folder text-warning me-1"></i>' : '';
            badges += `<span class="badge border border-secondary text-dark bg-white shadow-sm me-1 mb-1 fw-normal px-2 py-1">${icon}${child.displayName || child.DisplayName}</span>`;
            if (isFolder) badges += getDescendantBadges(child.id || child.MenuId, allMenus);
        });
        return badges;
    }

<<<<<<< HEAD
    roots.forEach(m => {
        const mEnabled = m.enabled !== undefined ? m.enabled : (m.IsEnabled !== undefined ? m.IsEnabled : true);
        const mMode = m.menuMode || m.MenuMode; const mTarget = m.target || m.OpenTarget;
        const mUrl = m.url || m.Url || m.targetPage || m.TargetPage || '#';
        const mId = m.id || m.MenuId; const mDName = m.displayName || m.DisplayName; const mSysName = m.name || m.SysName;

        let statusSwitch = `<div class="form-check form-switch d-flex justify-content-center"><input class="form-check-input" type="checkbox" ${mEnabled ? 'checked' : ''} disabled></div>`;
        let typeBadge = mMode === 'folder' ? '<span class="badge bg-warning text-dark border"><i class="fas fa-folder me-1"></i>主選單</span>' : (mMode === 'app_grid' ? '<span class="badge bg-success text-white border"><i class="fas fa-th-large me-1"></i>應用集合</span>' : '<span class="badge border border-primary text-primary bg-white"><i class="fas fa-link me-1"></i>獨立網頁</span>');

        let contentTxt = '';
        if (mMode === 'folder') { contentTxt = getDescendantBadges(mId, menus); if (!contentTxt) contentTxt = '<span class="text-muted small">無內容</span>'; }
        else if (mMode === 'app_grid') { contentTxt = `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 me-1"><i class="fas fa-th-large me-1"></i>內部應用集合區</span>`; }
        else { contentTxt = `<span class="text-muted small"><i class="fas fa-link me-1"></i>${mUrl}</span>`; }

        let actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-primary shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); openAddMenuNodeModal('${mId}');" title="編輯"><i class="fas fa-edit"></i></button>`;
        if (typeof canManageFolderStructure === 'function' && canManageFolderStructure(mId)) {
            actionBtnsHtml += `<button type="button" class="btn btn-sm btn-outline-danger shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); deleteMenuNodeItem('${mId}')" title="刪除"><i class="fas fa-trash-alt"></i></button>`;
        }
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        // ⭐️ 核心修復：加入 drag-handle 拖曳圖示與對齊縮排
        let sysNameHtml = `<div class="fw-bold text-dark fs-6"><i class="fas fa-grip-vertical text-muted me-2 opacity-50 cursor-move drag-handle" style="cursor: grab;"></i>${mDName}</div><div class="text-muted small" style="margin-left: 1.4rem;">${mSysName}</div>`;

        // ⭐️ 核心修復：加入 draggable="true" 與對應的拖曳事件，開啟「選單配置管理」的全局排序功能
        tbody.innerHTML += `<tr class="draggable-row" draggable="true" ondragstart="handleDragStart(event, '${mId}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${mId}', null, 'system')"><td class="text-start ps-3 align-middle">${sysNameHtml}</td><td class="align-middle">${typeBadge}</td><td class="align-middle">${statusSwitch}</td><td class="text-start align-middle" style="max-width: 400px; white-space: normal;">${contentTxt}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
=======
    // ⭐️ 遞迴取得所有子孫節點的膠囊 UI (加入 visited 防止無窮迴圈崩潰！)
    function getDescendantBadges(parentId, allMenus, visited = new Set()) {
        if (visited.has(parentId)) return '';
        visited.add(parentId);

        let badges = '';
        let children = allMenus.filter(x => x.id !== parentId && (window.isParentMatch(x.parentId, { id: parentId }) || (x.parentIds || []).some(pid => window.isParentMatch(pid, { id: parentId }))));
        children.sort((a, b) => (a.parentOrders?.[parentId] ?? a.order ?? 0) - (b.parentOrders?.[parentId] ?? b.order ?? 0));

        children.forEach(child => {
            let isFolder = child.menuMode === 'folder';
            let icon = isFolder ? '<i class="fas fa-folder text-warning me-1"></i>' : '';
            badges += `<span class="badge border border-secondary text-dark bg-white shadow-sm me-1 mb-1 fw-normal px-2 py-1">${icon}${child.displayName}</span>`;
            if (isFolder) {
                badges += getDescendantBadges(child.id, allMenus, visited);
            }
        });
        return badges;
    }

    roots.forEach(m => {
        // ⭐️ 狀態開關互動功能：移除 disabled 並綁定 onchange 事件
        let statusSwitch = `<div class="form-check form-switch d-flex justify-content-center"><input class="form-check-input cursor-pointer" type="checkbox" ${m.enabled ? 'checked' : ''} onchange="window.toggleMenuEnable('${m.id}', this.checked)"></div>`;
        let typeBadge = m.menuMode === 'folder' ? '<span class="badge bg-warning text-dark border"><i class="fas fa-folder me-1"></i>主選單</span>' : (m.menuMode === 'app_grid' ? '<span class="badge bg-success text-white border"><i class="fas fa-th-large me-1"></i>應用集合</span>' : '<span class="badge border border-primary text-primary bg-white"><i class="fas fa-link me-1"></i>獨立網頁</span>');

        let contentTxt = '';
        if (m.menuMode === 'folder') {
            contentTxt = getDescendantBadges(m.id, menus);
            if (!contentTxt) contentTxt = '<span class="text-muted small">無內容</span>';
        } else if (m.menuMode === 'app_grid') {
            contentTxt = `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 me-1"><i class="fas fa-th-large me-1"></i>內部應用集合區</span>`;
        } else {
            let targetTxt = m.target === 'iframe' ? '嵌入網頁' : (m.target === 'fullscreen' ? '全螢幕' : '另開分頁');
            contentTxt = `<span class="text-muted small"><i class="fas fa-link me-1"></i>${m.url || m.targetPage}</span>`;
        }

        let actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-primary shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); openAddMenuNodeModal('${m.id}');" title="編輯"><i class="fas fa-edit"></i></button>`;
        if (typeof canManageFolderStructure === 'function' && canManageFolderStructure(m.id)) {
            actionBtnsHtml += `<button type="button" class="btn btn-sm btn-outline-danger shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); deleteMenuNodeItem('${m.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>`;
        }
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        let sysNameHtml = `<div class="fw-bold text-dark fs-6">${m.displayName}</div><div class="text-muted small">${m.name}</div>`;

        tbody.innerHTML += `
        <tr>
            <td class="text-start ps-3 align-middle">${sysNameHtml}</td>
            <td class="align-middle">${typeBadge}</td>
            <td class="align-middle">${statusSwitch}</td>
            <td class="text-start align-middle" style="max-width: 400px; white-space: normal;">${contentTxt}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
    });
    // 初始化 DataTables
    initDataTable('dtMenuConfig', false);
}

function renderApplyTable() {
    safeDestroyDataTable('dtApply'); const tbody = document.getElementById('applyTableBody');
    if (!tbody || !currentUser) return; tbody.innerHTML = '';
    const reqs = getRequests().filter(r => (r.empId || r.EmpId) === currentUser.id).sort((a, b) => (b.timestamp || b.Timestamp) - (a.timestamp || a.Timestamp));
    const statusMap = { 'pending': '<span class="badge bg-secondary">待審核</span>', 'processing': '<span class="badge bg-primary">處理中</span>', 'resolved': '<span class="badge bg-success">已完成</span>', 'rejected': '<span class="badge bg-danger">已駁回</span>', 'withdrawn': '<span class="badge bg-dark">已撤回</span>' };

    reqs.forEach(r => {
        let dateStr = r.timestamp || r.Timestamp;
        if (typeof dateStr === 'number') {
            let now = new Date(dateStr); let pad = (n) => n < 10 ? '0' + n : n;
            dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        const typeBadge = `<span class="badge border border-secondary text-secondary bg-light mb-1">${r.reqType || r.ReqType || '系統需求'}</span>`;
        const replyTxt = r.reply || r.Reply;
        const replyMsg = replyTxt ? `<div class="small text-primary fw-bold text-truncate" style="max-width: 250px;" title="${replyTxt}"><i class="fas fa-comment-dots me-1"></i>${replyTxt}</div>` : '<span class="text-muted small"><i class="fas fa-hourglass-half me-1"></i>等待管理員處理中...</span>';

        const rStatus = r.status || r.Status || 'pending'; const rId = r.id || r.RequestId || r.Id;
        let actionBtnsHtml = '';
        if (rStatus === 'withdrawn') actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); deleteApplyItem('${rId}')"><i class="fas fa-trash-alt me-1"></i> 刪除紀錄</button>`;
        else if (rStatus === 'pending' || !rStatus) actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-warning text-dark py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); withdrawApply('${rId}');"><i class="fas fa-undo me-1"></i> 撤回</button>`;
        else actionBtnsHtml = `<span class="badge bg-light text-muted border">審核中/已鎖定</span>`;

        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;
        let wdInfo = rStatus === 'withdrawn' ? `<div class="text-danger mt-1 small fw-bold"><i class="fas fa-info-circle"></i> 撤回原因: ${r.withdrawReason || r.WithdrawReason}</div>` : '';

        tbody.innerHTML += `<tr><td class="small text-muted align-middle">${dateStr}</td><td class="align-middle">${typeBadge}<br><span class="fw-bold small text-dark">${r.fab || r.FabId || '全域 (Global)'}</span></td><td class="align-middle text-start"><div class="fw-bold text-dark" style="white-space: pre-wrap; font-size:0.85rem;">${r.reason || r.Reason}</div>${wdInfo}</td><td class="align-middle">${statusMap[rStatus]}</td><td class="align-middle text-start">${replyMsg}</td><td class="text-center align-middle" onmouseenter="this.closest('tr').setAttribute('draggable', false)" onmouseleave="this.closest('tr').setAttribute('draggable', true)" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtApply', true);
}

function renderAuditTable() {
    safeDestroyDataTable('dtAudit'); const tbody = document.getElementById('auditTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const reqs = getRequests().sort((a, b) => (b.timestamp || b.Timestamp) - (a.timestamp || a.Timestamp));
    const statusMap = { 'pending': '<span class="badge bg-secondary">待審核</span>', 'processing': '<span class="badge bg-primary">處理中</span>', 'resolved': '<span class="badge bg-success">已完成</span>', 'rejected': '<span class="badge bg-danger">已駁回</span>', 'withdrawn': '<span class="badge bg-dark">已撤回</span>' };

    reqs.forEach(r => {
        let dateStr = r.timestamp || r.Timestamp;
        if (typeof dateStr === 'number') {
            let now = new Date(dateStr); let pad = (n) => n < 10 ? '0' + n : n;
            dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        const typeBadge = `<span class="badge border border-secondary text-secondary bg-light mb-1">${r.reqType || r.ReqType || '系統需求'}</span>`;
        const rStatus = r.status || r.Status || 'pending';
        let wdInfo = rStatus === 'withdrawn' ? `<div class="text-danger mt-1 small fw-bold"><i class="fas fa-info-circle"></i> 撤回原因: ${r.withdrawReason || r.WithdrawReason}</div>` : '';
        const replyTxt = r.reply || r.Reply;
        const replyMsg = replyTxt ? `<div class="small text-primary fw-bold text-truncate" style="max-width: 200px;" title="${replyTxt}"><i class="fas fa-comment-dots me-1"></i>${replyTxt}</div>` : '<span class="text-muted small">尚未回覆</span>';
        const rId = r.id || r.RequestId || r.Id;

        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2"><button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); openAuditModal('${rId}');"><i class="fas fa-reply me-1"></i>回覆</button></div>`;
        tbody.innerHTML += `<tr><td class="align-middle"><div class="fw-bold text-dark">${r.empName || r.EmpName}</div><div class="small text-muted fw-normal">${r.empId || r.EmpId}</div></td><td class="small text-muted align-middle">${dateStr}</td><td class="align-middle">${typeBadge}<br><span class="fw-bold small text-dark">${r.fab || r.FabId || '全域'}</span></td><td class="align-middle text-start" style="max-width: 250px;"><div class="text-truncate text-dark fw-bold" title="${r.reason || r.Reason}">${r.reason || r.Reason}</div>${wdInfo}</td><td class="align-middle">${statusMap[rStatus]}</td><td class="align-middle text-start">${replyMsg}</td><td class="text-center align-middle" onmouseenter="this.closest('tr').setAttribute('draggable', false)" onmouseleave="this.closest('tr').setAttribute('draggable', true)" style="white-space: nowrap; width: 1%;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtAudit', true);
}

function renderAppGrid(containerId, appList) {
    const container = document.getElementById(containerId); if (!container) return; let html = '';
    appList.forEach(app => {
        let imgHtml = (app.iconBase64 || app.IconBase64) ? `<img src="${app.iconBase64 || app.IconBase64}" class="app-icon-img" alt="${app.name || app.AppName}">` : `<i class="fas fa-cube text-muted" style="font-size:2rem;"></i>`;
        let clickAction = (app.target || app.Target) === 'iframe' ? `openDynamicIframe('${app.url || app.Url}', '${app.name || app.AppName}', null, false)` : `window.open('${app.url || app.Url}', '_blank')`;
        html += `<div class="app-card" title="${app.name || app.AppName}"><div class="app-actions d-flex flex-nowrap justify-content-center gap-2"><button class="app-btn-action app-btn-edit" onclick="event.stopPropagation(); openAppGridModal('${app.id || app.AppId}');"><i class="fas fa-pencil-alt"></i></button><button class="app-btn-action app-btn-delete" onclick="event.stopPropagation(); deleteAppItem('${app.id || app.AppId}');"><i class="fas fa-times"></i></button></div><div class="app-icon-box" onclick="${clickAction}">${imgHtml}</div><div class="app-name" onclick="${clickAction}">${app.name || app.AppName}</div></div>`;
    });
    html += `<div class="app-card app-add" title="新增 APP"><div class="app-icon-box app-add-box" onclick="openAppGridModal();"><i class="fas fa-plus"></i></div><div class="app-name text-muted">新增 APP</div></div>`;
    container.innerHTML = html;
}

// === 帳號管理專屬 Modal 繪製 ===
function renderAccRoleCheckboxes(selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('accRoleCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    getRoles().forEach(r => {
        const rId = r.id || r.roleId || r.RoleId || '';
        const rName = r.groupName || r.GroupName || rId;
        const isChecked = selectedIds.includes(rId) ? 'checked' : '';

        container.innerHTML += `
            <div class="form-check form-check-inline border rounded px-3 py-1 bg-white mb-1 shadow-sm" style="border-color: #dee2e6 !important;">
                <input class="form-check-input ms-0 me-2 acc-role-cb cursor-pointer" type="checkbox" id="acr_${rId}" value="${rId}" ${isChecked}>
                <label class="form-check-label small fw-bold text-dark cursor-pointer" for="acr_${rId}">${rName}</label>
            </div>
        `;
    });
}

function renderAccManageMenuCheckboxes(selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('accManageMenuCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    const menus = getCustomMenus().filter(m => String(m.menuMode || m.MenuMode).toLowerCase() === 'folder' && (m.enabled !== false && m.IsEnabled !== false));

    if (menus.length === 0) {
        container.innerHTML = '<div class="text-muted small px-2 py-1"><i class="fas fa-info-circle me-1 opacity-50"></i>無可授權的主選單資料夾</div>';
        return;
    }

    menus.forEach(m => {
        const mId = m.id || m.MenuId || '';
        const mDName = m.displayName || m.DisplayName || '';
        const isChecked = selectedIds.includes(mId) ? 'checked' : '';
        container.innerHTML += `
            <div class="form-check mb-1 ms-1 d-flex align-items-center">
                <input class="form-check-input acc-menu-cb cursor-pointer mt-0" type="checkbox" id="acm_${mId}" value="${mId}" ${isChecked}>
                <label class="form-check-label fw-bold text-dark cursor-pointer d-flex align-items-center ms-2" for="acm_${mId}">
                    <i class="fas fa-folder text-warning me-2 fs-5"></i> ${mDName}
                </label>
            </div>
        `;
    });
}

function renderAccDefaultPagesUI() {
    const container = document.getElementById('accDefaultPagesContainer'); if (!container) return;
    const fabs = getFabs(); const menus = getCustomMenus(); let html = '';

    fabs.forEach(f => {
        const fName = f.fabName || f.FabName || f.id || f.fabId || f.FabId || '';
        let defMenuId = tempDefaultPages[fName];
        let defMenuObj = menus.find(m => window.cleanId(m.id || m.MenuId) === window.cleanId(defMenuId));
        let displayTxt = defMenuObj ? getFullMenuPathStr(defMenuId, menus) : '系統自動抓取第一個可視看板';
        let txtColor = defMenuObj ? 'text-success fw-bold' : 'text-muted';

        html += `
            <div class="d-flex align-items-center mb-2 border-bottom pb-2">
                <span class="badge bg-secondary me-2" style="width: 45px;">${fName}</span>
                <span class="flex-grow-1 text-truncate small ${txtColor}" id="def_text_${fName}">預設：${displayTxt}</span>
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-3 fw-bold rounded-pill shadow-sm" onclick="openMenuSelector('${fName}')">指定</button>
                <button type="button" class="btn btn-sm btn-outline-danger border-0 py-0 px-2 ms-1" onclick="clearDefaultMenu('${fName}')" title="清除設定"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ⭐️ 物理強制關閉抽屜 (解掉 blocked aria-hidden focus 的錯誤)
window.closeMenuSelector = function () {
    if (document.activeElement) document.activeElement.blur();
    const drawerEl = document.getElementById('menuSelectDrawer');
    if (drawerEl) {
        drawerEl.classList.remove('show');
        setTimeout(() => { drawerEl.style.visibility = 'hidden'; }, 300);
    }
    const backdrop = document.getElementById('offcanvas-force-backdrop');
    if (backdrop) backdrop.remove();
};

window.toggleDrawerCollapse = function (e, targetId, element) {
    e.preventDefault(); e.stopPropagation();
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    if (targetEl.classList.contains('show')) {
        targetEl.classList.remove('show'); element.classList.add('collapsed'); element.setAttribute('aria-expanded', 'false');
    } else {
        targetEl.classList.add('show'); element.classList.remove('collapsed'); element.setAttribute('aria-expanded', 'true');
    }
};

window.openMenuSelector = function (fabName) {
    if (document.activeElement) document.activeElement.blur();

    let pickingInput = document.getElementById('pickingForFab');
    if (!pickingInput) {
        pickingInput = document.createElement('input');
        pickingInput.type = 'hidden'; pickingInput.id = 'pickingForFab';
        document.body.appendChild(pickingInput);
    }
    pickingInput.value = fabName;

    // 此時 HTML 中已經完美具備了 Z-index 10600 的 Drawer
    const drawerEl = document.getElementById('menuSelectDrawer');
    const container = document.getElementById('menuSelectDrawerContainer');
    container.innerHTML = '';
    const searchInput = document.getElementById('menuSelectSearchInput');
    if (searchInput) searchInput.value = '';

    const roleLevel = document.getElementById('accRoleLevel').value;
    let assignedRoles = []; document.querySelectorAll('.acc-role-cb:checked').forEach(cb => assignedRoles.push(cb.value));

    const fabs = getFabs();
    const fabObj = fabs.find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(fabName));
    const fabRoleIds = fabObj ? (fabObj.assignedRoles || fabObj.AssignedRoles || []) : [];

    const activeRoleIds = (roleLevel === 'admin') ? fabRoleIds : fabRoleIds.filter(id => assignedRoles.includes(id));
    const roles = getRoles(); let initialMenuIds = [];
    activeRoleIds.forEach(roleId => {
        const role = roles.find(r => window.cleanId(r.id || r.RoleId) === window.cleanId(roleId));
        const allowed = role ? (role.allowedMenuIds || role.AllowedMenuIds || []) : [];
        if (allowed) initialMenuIds.push(...allowed);
    });

    const allMenus = getCustomMenus();
    let allowedIds = new Set(initialMenuIds.map(id => window.cleanId(id)));

    if (roleLevel === 'admin') {
        allMenus.forEach(m => allowedIds.add(window.cleanId(m.id || m.MenuId)));
    } else {
        let added = true;
        while (added) {
            added = false;
            allMenus.forEach(m => {
                let mId = window.cleanId(m.id || m.MenuId);
                if (!allowedIds.has(mId)) {
                    let pId = window.cleanId(m.parentId || m.ParentMenuId || (m.parentIds && m.parentIds[0]));
                    if (allowedIds.has(pId)) { allowedIds.add(mId); added = true; }
                }
            });
        }
    }

    const viewableMenus = allMenus.filter(m => String(m.menuMode || m.MenuMode).toLowerCase() !== 'folder' && (m.enabled !== false && m.IsEnabled !== false) && allowedIds.has(window.cleanId(m.id || m.MenuId)));

    if (viewableMenus.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-5 fw-bold"><i class="fas fa-folder-open mb-3 fs-1 opacity-50"></i><br>此帳號在該廠區沒有可觀看的看板。<br><small class="fw-normal">請先勾選下方的可視群組版面。</small></div>`;
    } else {
        let groups = {};
        viewableMenus.forEach(m => {
            let rootNode = m;
            while (rootNode && (rootNode.parentId || rootNode.ParentMenuId || (rootNode.parentIds && rootNode.parentIds.length > 0))) {
                let pId = rootNode.parentId || rootNode.ParentMenuId || rootNode.parentIds[0];
                let parent = allMenus.find(x => window.cleanId(x.id || x.MenuId) === window.cleanId(pId));
                if (parent) rootNode = parent; else break;
            }

            let rId = rootNode ? window.cleanId(rootNode.id || rootNode.MenuId) : 'other';
            let rName = rootNode ? (rootNode.displayName || rootNode.DisplayName || rootNode.name || rootNode.SysName) : '其他獨立看板';
            if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + rId] && rootNode && !rootNode.isEdited && !rootNode.IsEdited) rName = i18n[currentLang]['dyn_' + rId];

            const rOrder = rootNode ? (rootNode.order || rootNode.GlobalOrder || 999) : 999;
            const rIcon = rootNode ? (rootNode.icon || rootNode.Icon || 'fas fa-link') : 'fas fa-link';

            if (!groups[rId]) groups[rId] = { rootName: rName, rootIcon: rIcon, items: [], order: rOrder };

            const mId = window.cleanId(m.id || m.MenuId);
            let fullPathStr = typeof getFullMenuPathStr === 'function' ? getFullMenuPathStr(mId, allMenus) : (m.displayName || m.DisplayName);
            let pathArr = fullPathStr.split(' / ');
            if (pathArr.length > 1) pathArr.shift(); pathArr.pop();
            let subPath = pathArr.join(' / ');

            const mMode = m.menuMode || m.MenuMode;
            const mOrder = m.order || m.GlobalOrder || 999;
            groups[rId].items.push({ id: mId, name: m.name || m.SysName, displayName: m.displayName || m.DisplayName, subPath: subPath, type: mMode, order: mOrder });
        });

        const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[a].order - groups[b].order);
        let html = ``; let isFirst = true;

        sortedGroupKeys.forEach((rId, index) => {
            let group = groups[rId];
            group.items.sort((a, b) => a.order - b.order);

            let listHtml = `<div class="bg-white border border-top-0 rounded-bottom pt-1 pb-2 shadow-sm">`;
            group.items.forEach(item => {
                let badge = item.type === 'app_grid' ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 ms-2" style="font-size:0.6rem;">應用集合</span>' : '';
                let subPathHtml = item.subPath ? `<div class="badge bg-secondary bg-opacity-10 text-secondary border mt-1 fw-normal" style="font-size:0.65rem;">位於: ${item.subPath}</div>` : '';

                listHtml += `
                    <div class="drawer-item d-flex justify-content-between align-items-center p-2 border-bottom cursor-pointer hover-bg-light" style="transition: all 0.2s;" onclick="pickDefaultMenu('${item.id}'); window.closeMenuSelector();">
                        <div class="pe-2">
                            <div class="fw-bold text-dark d-flex align-items-center mb-0" style="font-size: 0.85rem;">
                                <i class="fas ${item.type === 'app_grid' ? 'fa-th-large text-success' : 'fa-file-alt text-secondary'} item-icon me-2 opacity-75"></i> ${item.displayName} ${badge}
                            </div>
                            ${subPathHtml}
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary px-3 fw-bold rounded-pill shadow-sm bg-white" style="font-size: 0.75rem; flex-shrink: 0;" onclick="event.stopPropagation(); pickDefaultMenu('${item.id}'); window.closeMenuSelector();">選取</button>
                    </div>
                `;
            });
            listHtml += `</div>`;

            let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(group.rootIcon, 'text-primary', '', true) : `<i class="${group.rootIcon} text-primary"></i>`;

            html += `
                <div class="drawer-group mb-3">
                    <div class="drawer-group-title bg-white border rounded shadow-sm p-3 d-flex justify-content-between align-items-center cursor-pointer ${isFirst ? '' : 'collapsed'}" onclick="window.toggleDrawerCollapse(event, 'drawer_col_${index}', this)" aria-expanded="${isFirst ? 'true' : 'false'}">
                        <div class="d-flex align-items-center">
                            <div style="width:24px; text-align:center;" class="me-2">${iconHtml}</div>
                            <span class="fw-bold text-dark fs-6">${group.rootName}</span>
                        </div>
                        <span class="badge bg-white text-dark border border-secondary rounded-pill shadow-sm px-2">${group.items.length}</span>
                    </div>
                    <div class="collapse ${isFirst ? 'show' : ''}" id="drawer_col_${index}">
                        ${listHtml}
                    </div>
                </div>
            `;
            isFirst = false;
        });
        container.innerHTML = html;
    }

    // ⭐️ 物理強制霸道展開：無條件將抽屜移到 body 最末端，套用突破天際的 z-index 999999
    if (drawerEl) {
        if (drawerEl.parentElement !== document.body) {
            document.body.appendChild(drawerEl);
        }
        drawerEl.style.setProperty('z-index', '999999', 'important');
        drawerEl.style.setProperty('position', 'fixed', 'important');
        drawerEl.style.visibility = 'visible';
        void drawerEl.offsetWidth;
        drawerEl.classList.add('show');

        let offBackdrop = document.getElementById('offcanvas-force-backdrop');
        if (!offBackdrop) {
            offBackdrop = document.createElement('div');
            offBackdrop.id = 'offcanvas-force-backdrop';
            offBackdrop.className = 'modal-backdrop fade show';
            offBackdrop.style.setProperty('z-index', '999998', 'important');
            offBackdrop.onclick = window.closeMenuSelector;
            document.body.appendChild(offBackdrop);
        }

        setTimeout(() => { const input = document.getElementById('menuSelectSearchInput'); if (input) input.focus(); }, 300);
    }
};

window.filterMenuSelectDrawer = function () {
    const input = document.getElementById('menuSelectSearchInput').value.toLowerCase();
    const groups = document.querySelectorAll('#menuSelectDrawerContainer .drawer-group');

    groups.forEach(grpItem => {
        const listItems = grpItem.querySelectorAll('.drawer-item');
        let hasVisibleChild = false;

        listItems.forEach(li => {
            const text = li.innerText.toLowerCase();
            if (text.includes(input)) {
                li.style.setProperty('display', 'flex', 'important');
                hasVisibleChild = true;
            } else {
                li.style.setProperty('display', 'none', 'important');
            }
        });

        if (hasVisibleChild) {
            grpItem.style.display = 'block';
            if (input.trim() !== '') {
                const collapseEl = grpItem.querySelector('.collapse');
                if (collapseEl && !collapseEl.classList.contains('show')) {
                    collapseEl.classList.add('show');
                    const titleEl = grpItem.querySelector('.drawer-group-title');
                    if (titleEl) { titleEl.classList.remove('collapsed'); titleEl.setAttribute('aria-expanded', 'true'); }
                }
            }
        } else {
            grpItem.style.display = 'none';
        }
    });
<<<<<<< HEAD
};

// =========================================================================
// ⭐️ 核心防跳回機制：霸道接管「群組編輯」的渲染與儲存，強制以 GlobalOrder 為唯一真理！
// =========================================================================

// 1. 接管渲染：打開權限編輯時，強制照著 GlobalOrder 排序，拒絕接受後端錯亂的 array order
window.renderRoleMenuCheckboxes = function (selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('roleMenuCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    const menus = getCustomMenus().filter(m =>
        (m.enabled !== false && m.IsEnabled !== false) &&
        String(m.isPoolItem || m.IsPoolItem).toLowerCase() !== 'true' &&
        (!window.cleanId(m.parentId || m.ParentMenuId) || window.cleanId(m.parentId || m.ParentMenuId) === '')
    );

    // ⭐️ 核心：以 GlobalOrder 為最高準則進行排序
    menus.sort((a, b) => (a.order || 0) - (b.order || 0));

    let sortedMenus = [];
    menus.forEach(m => { if (selectedIds.includes(window.cleanId(m.id || m.MenuId))) sortedMenus.push(m); });
    menus.forEach(m => { if (!selectedIds.includes(window.cleanId(m.id || m.MenuId))) sortedMenus.push(m); });

    sortedMenus.forEach(m => {
        const mId = window.cleanId(m.id || m.MenuId || '');
        const mDName = m.displayName || m.DisplayName || '';
        const isSelected = selectedIds.includes(mId);
        const bgClass = isSelected ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-secondary';
        const chkClass = isSelected ? 'fas fa-check-circle' : 'far fa-circle opacity-50';

        container.innerHTML += `
            <div class="role-menu-item d-inline-flex align-items-center border rounded px-2 py-1 cursor-pointer shadow-sm ${bgClass}" 
                 style="transition: all 0.2s; font-size: 0.95rem;" draggable="true" 
                 ondragstart="window.rmDragStart(event, '${mId}')" ondragover="window.rmDragOver(event)" ondragleave="window.rmDragLeave(event)" ondrop="window.rmDrop(event, '${mId}')"
                 onclick="typeof toggleRoleMenuSelection === 'function' ? toggleRoleMenuSelection(this) : null">
                <i class="fas fa-grip-vertical me-2 opacity-50" title="拖曳排序" onclick="event.stopPropagation()"></i>
                <i class="role-check-icon ${chkClass} me-1"></i>
                <span class="fw-bold tracking-wide">${mDName}</span>
                <input type="checkbox" class="d-none role-menu-cb" value="${mId}" ${isSelected ? 'checked' : ''}>
            </div>
        `;
    });
};

// 2. 接管儲存：儲存群組時，順手將面板上拖曳的順序，永久寫入主選單的 GlobalOrder！
window.saveRoleItem = function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
        const id = document.getElementById('editRoleId').value;
        const name = document.getElementById('roleName').value.trim();

        let allowed = [];
        let menus = getCustomMenus();
        let orderCounter = 10;

        // ⭐️ 核心：掃描拖曳後的面板順序，將新的順序強制寫入每一個主選單的 menu.order (GlobalOrder)
        document.querySelectorAll('.role-menu-item').forEach(el => {
            const cb = el.querySelector('.role-menu-cb');
            if (cb) {
                if (cb.checked) allowed.push(cb.value);
                let m = menus.find(x => window.cleanId(x.id || x.MenuId) === window.cleanId(cb.value));
                if (m) m.order = orderCounter;
                orderCounter += 10;
            }
        });

        let roles = getRoles();
        if (id) {
            let r = roles.find(x => window.cleanId(x.id) === window.cleanId(id));
            if (r) { r.groupName = name; r.allowedMenuIds = allowed; }
        } else {
            roles.push({ id: 'role_' + Date.now(), groupName: name, allowedMenuIds: allowed });
        }

        // 同步回 AppState，確保 syncDataToDB 抓到的是包含最新 GlobalOrder 的選單！
        if (window.appState && window.appState.menus) window.appState.menus = menus;
        if (window.appState && window.appState.roles) window.appState.roles = roles;

        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof hideModalSafely === 'function') hideModalSafely('roleModal');
        if (typeof renderRoleTable === 'function') renderRoleTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable(); // 順便更新配置表的排序
    } catch (error) { console.error("[saveRoleItem] 錯誤:", error); }
    return false;
};
=======
}
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
