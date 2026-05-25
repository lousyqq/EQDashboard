// ====== render.js 最上方的修復 ======
window.cleanId = function (id) {
    // 檢查是否為空值 (null, undefined, NaN)
    if (id == null) return '';

    // 如果是數字，強制轉為字串
    let s = String(id);

    // 徹底防禦：如果轉完還是空的，直接回傳
    if (!s || s === 'undefined' || s === 'null') return '';

    // 執行洗淨
    return s.replace(/[\s\[\]"']/g, '').toLowerCase();
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

// === 對齊 TEST_20260429.html:2525 的階層展開工具 ===
window.getAllowedIdsWithHierarchy = function (menus, initialIds) {
    let ids = new Set(initialIds);
    let size = 0;
    while (ids.size > size) {
        size = ids.size;
        menus.forEach(m => {
            if (m.parentId && ids.has(m.parentId)) ids.add(m.id);
            if (m.parentIds) m.parentIds.forEach(p => { if (ids.has(p)) ids.add(m.id); });
        });
    }
    return ids;
};

// === 對齊 TEST_20260429.html:2565 的權限判定 ===
//  - admin → 全開
//  - user (非委派) → 都沒有
//  - user (有委派) →
//      * 自己建立 (createdBy === currentUser.id) → 可編輯/刪除
//      * 被委派的節點本身或其下層子節點 → 可管理結構；若 canEditOthers=true，也能編輯/刪除別人的網頁
//      * 委派節點的祖先 → 可管理結構（為了能在 Tree Builder 點到他）
window.getMenuPermissions = function (nodeId, nodeCreatedBy) {
    let perms = { canView: false, canEdit: false, canDelete: false, canAddChild: false, canManageStructure: false };
    if (!currentUser) return perms;
    if (currentUser.roleLevel === 'admin') {
        return { canView: true, canEdit: true, canDelete: true, canAddChild: true, canManageStructure: true };
    }

    const isMyOwn = (nodeCreatedBy && window.cleanId(nodeCreatedBy) === window.cleanId(currentUser.id));
    const manage = currentUser.manageableMenus || [];
    const isDelegatedNode = manage.some(m => window.cleanId(m) === window.cleanId(nodeId));

    const menus = getCustomMenus();

    function isUnderDelegated(nId) {
        if (!manage || manage.length === 0) return false;
        let queue = [nId];
        let visited = new Set();
        while (queue.length > 0) {
            let curr = queue.shift();
            if (manage.some(m => window.cleanId(m) === window.cleanId(curr))) return true;
            visited.add(window.cleanId(curr));
            let m = menus.find(x => window.cleanId(x.id) === window.cleanId(curr));
            if (m) {
                if (m.parentId && !visited.has(window.cleanId(m.parentId))) queue.push(m.parentId);
                if (m.parentIds) m.parentIds.forEach(p => { if (!visited.has(window.cleanId(p))) queue.push(p); });
            }
        }
        return false;
    }

    function isAncestorOfDelegated(nId) {
        if (!manage || manage.length === 0) return false;
        for (let delId of manage) {
            let queue = [delId];
            let visited = new Set();
            while (queue.length > 0) {
                let curr = queue.shift();
                if (window.cleanId(curr) === window.cleanId(nId)) return true;
                visited.add(window.cleanId(curr));
                let m = menus.find(x => window.cleanId(x.id) === window.cleanId(curr));
                if (m) {
                    if (m.parentId && !visited.has(window.cleanId(m.parentId))) queue.push(m.parentId);
                    if (m.parentIds) m.parentIds.forEach(p => { if (!visited.has(window.cleanId(p))) queue.push(p); });
                }
            }
        }
        return false;
    }

    const isUnder = isUnderDelegated(nodeId);
    const isAncestor = isAncestorOfDelegated(nodeId);

    if (isMyOwn) {
        perms.canEdit = true;
        perms.canDelete = true;
        perms.canManageStructure = true;
    }
    if (isDelegatedNode || isUnder) {
        perms.canManageStructure = true;
        if (currentUser.canEditOthers) {
            perms.canEdit = true;
            perms.canDelete = true;
        }
    }
    if (isAncestor) {
        perms.canManageStructure = true;
    }

    if (perms.canEdit || perms.canManageStructure || isDelegatedNode || isUnder || isAncestor) {
        perms.canAddChild = true;
        perms.canView = true;
    }
    return perms;
};

// === 對齊 TEST_20260429.html 的 toggleSubMenu，自製 collapse 開合（取代 Bootstrap data-bs-toggle 觸發器）===
window.toggleSubMenu = function (e, targetId, element) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const target = document.getElementById(targetId);
    if (!target || !element) return;
    if (target.classList.contains('show')) {
        target.classList.remove('show');
        target.style.display = 'none';
        element.classList.add('collapsed');
        element.setAttribute('aria-expanded', 'false');
    } else {
        target.classList.add('show');
        target.style.display = 'block';
        element.classList.remove('collapsed');
        element.setAttribute('aria-expanded', 'true');
    }
};

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
        const cCurrentFab = window.cleanId(window.currentFab || currentFab);
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

        // 對齊 TEST_20260429.html:3216 — disabled 項目對所有人（含 admin）都不顯示在側邊欄/上方導覽
        const inPersonalMode = (currentLayoutMode === 'personal');
        let validMenus = menus.filter(m => {
            let cId = window.cleanId(m.id);
            if (!cId || !allowedSet.has(cId)) return false;
            if (m.enabled === false) return false;
            return true;
        });
        menus = validMenus;

        // 排序：root 與子節點都以 m.order (GlobalOrder) 為準
        //  - saveRoleItem 拖曳後會把 root 的 m.order 寫成 10/20/30...
        //  - 個人模式下，個人設定的 order 已透過上面的迴圈套用至 m.order
        menus.sort((a, b) => (a.order || 0) - (b.order || 0));

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
                { id: 'page-personal-manage', icon: 'fas fa-user-cog', name: '個人頁面管理', display: currentLayoutMode === 'personal' },
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

                subMenus.forEach(child => { html += generateSidebarMenuItem(child, menus, 1, true); });
            }
        }
        const sidebarContainer = document.getElementById('dynamic-sidebar-menus');
        if (sidebarContainer) sidebarContainer.innerHTML = html;

    } catch (err) { console.error("renderSidebarMenus error", err); }
}

function generateSidebarMenuItem(menu, allMenus, level, forceExpand = true) {
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

// ⭐️ 補回遺失的首頁儀表板渲染邏輯
window.renderHomeDashboard = function () {
    try {
        if (!currentUser) return;
        const homeRole = document.getElementById('home-role-title');
        const homeRoleLvl = document.getElementById('home-role-level');
        if (homeRole) homeRole.innerText = currentUser.roleLevel === 'admin' ? '系統管理員' : '一般使用者';
        if (homeRoleLvl) homeRoleLvl.innerText = currentUser.roleLevel === 'admin' ? '(Admin)' : '(User)';

        const fabs = getFabs();
        let currentFabObj = fabs.find(f => window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(window.currentFab));
        let displayDName = currentFabObj ? (currentFabObj.displayName || currentFabObj.DisplayName || currentFabObj.fabName || currentFabObj.FabName) : window.currentFab;

        const homeFab = document.getElementById('home-fab-display');
        if (homeFab) homeFab.innerText = displayDName;

        // 同步右上角頭像下拉的使用者資訊（對齊 TEST_20260429.html:2917-2930）
        if (typeof window.renderUserDropdown === 'function') window.renderUserDropdown();
    } catch (e) { console.error("renderHomeDashboard error", e); }
};

// 右上角使用者下拉資訊（姓名、部門、累積登入次數、本次登入時間）
window.renderUserDropdown = function () {
    if (!currentUser) return;
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    setText('user-name', currentUser.id || '');
    const loginCount = currentUser.loginCount || 1;
    setHtml('user-role',
        '這是您第 <span style="color:#38bdf8; font-weight:800; font-size:0.75rem;">' + loginCount + '</span> 次登入');

    setText('dropdown-user-name', (currentUser.name || '') + ' (' + (currentUser.id || '') + ')');
    setText('dropdown-user-dept', currentUser.department || '未設定部門');
    setText('dropdown-user-login-count', loginCount + ' 次');
    setText('dropdown-user-login-time', currentUser.currentLoginTime || '00:00 AM');
};
// =========================================================================
// ⭐️ 無敵雙重容錯版：自動相容各種 HTML ID 命名，且直接讀取底層記憶體！
// =========================================================================
window.renderFabSwitcher = function () {
    // ⭐️ 核心修正 1：雙重 ID 尋找機制！不論您 HTML 裡面叫 dropdown 還是 switcher 都能抓到
    const fabMenu = document.getElementById('fab-dropdown-menu') || document.getElementById('fab-switcher-menu');
    const fabNameDisplay = document.getElementById('current-fab-name') || document.getElementById('current-fab-display');
    const homeFabDisplay = document.getElementById('home-fab-display');

    if (!fabMenu) {
        console.error("🚨 找不到廠區下拉容器，請確認 index.html 裡面有 id='fab-dropdown-menu'");
        return;
    }

    // 直接從全域記憶體取得 fabs
    const allFabs = (window.appState && window.appState.fabs) ? window.appState.fabs : [];

    // ⭐️ 依「可視群組版面 (currentUser.assignedRoles)」與「fab.assignedRoles」的交集過濾廠區
    //    fab 的 assignedRoles 與帳號的 assignedRoles 有任何共同 role → 該廠區可見
    //    admin 也套用同規則（admin 帳號預設綁定所有 role 即可看到所有廠區）
    const userRoleIds = (currentUser && (currentUser.assignedRoles || currentUser.AssignedRoles) || [])
        .map(window.cleanId);
    const fabs = !currentUser ? allFabs : allFabs.filter(f => {
        const fabRoles = (f.assignedRoles || f.AssignedRoles || []).map(window.cleanId);
        // 若該廠區沒設任何 role，視為「無人可見」（與舊版單檔的隱含規則一致）
        if (fabRoles.length === 0) return false;
        return fabRoles.some(r => userRoleIds.includes(r));
    });

    fabMenu.innerHTML = '';

    if (fabs.length === 0) {
        fabMenu.innerHTML = '<li><span class="dropdown-item text-muted px-3 py-2"><i class="fas fa-exclamation-circle me-1"></i>無可用廠區資料</span></li>';
        if (fabNameDisplay) fabNameDisplay.innerText = '無';
        if (homeFabDisplay) homeFabDisplay.innerText = '無';
        return;
    }

    // 初始化 / 校正 currentFab：若目前 currentFab 不在可見清單中，自動切到第一個
    const isCurrentVisible = !!fabs.find(f =>
        window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(window.currentFab)
    );
    if (!window.currentFab || !isCurrentVisible) {
        const first = fabs[0];
        window.currentFab = first.fabName || first.FabName || first.id || first.fabId || first.FabId;
        try { currentFab = window.currentFab; } catch (e) { }
    }

    // 尋找目前的廠區物件以取得顯示名稱
    const currentFabObj = fabs.find(f =>
        window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(window.currentFab)
    );
    const displayDName = currentFabObj
        ? (currentFabObj.displayName || currentFabObj.DisplayName || currentFabObj.fabName || currentFabObj.FabName)
        : window.currentFab;

    if (fabNameDisplay) fabNameDisplay.innerText = displayDName;
    if (homeFabDisplay) homeFabDisplay.innerText = displayDName;

    // 動態產生選單項目（已過濾過的 fabs）
    fabs.forEach(f => {
        const fName = f.fabName || f.FabName || f.id || f.fabId || f.FabId;
        const dName = f.displayName || f.DisplayName || fName;
        const isCurrent = window.cleanId(fName) === window.cleanId(window.currentFab);

        fabMenu.innerHTML += `
          <li>
            <a class="dropdown-item py-2 fw-bold d-flex justify-content-between align-items-center ${isCurrent ? 'bg-primary text-white' : ''}"
               href="#"
               data-fab="${String(fName).replace(/"/g, '&quot;')}">
              <span><i class="fas fa-industry me-2 small ${isCurrent ? 'text-white' : 'text-secondary'}"></i>${dName}</span>
              ${isCurrent ? '<i class="fas fa-check ms-2"></i>' : ''}
            </a>
          </li>
        `;
    });

    // 綁定點擊事件 (精準攔截 a 標籤內的所有點擊)
    if (!fabMenu.hasAttribute('data-fab-bound')) {
        fabMenu.setAttribute('data-fab-bound', '1');
        fabMenu.addEventListener('click', function (e) {
            const a = e.target.closest('a[data-fab]');
            if (!a) return;
 
            e.preventDefault();
            // ✅ 不要 stopPropagation，讓 Bootstrap 的自動收合機制可以運作
            // e.stopPropagation();
 
            const selectedFab = a.getAttribute('data-fab');
            window.switchFab(selectedFab);
 
            // ✅ 手動保險收合（就算別的地方擋掉，也一定會關）
            const dropdownBtn = fabMenu.closest('.dropdown')?.querySelector('button[data-bs-toggle="dropdown"]');
            if (dropdownBtn && window.bootstrap?.Dropdown) {
                bootstrap.Dropdown.getOrCreateInstance(dropdownBtn).hide();
            }
        });
 
    }
};
 
// ⭐️ 廠區切換引擎（依「可視廠區」防呆）
window.switchFab = function (fabName) {
    if (!fabName) return;
    if (window.cleanId(window.currentFab) === window.cleanId(fabName)) return;

    const fabs = (window.appState && window.appState.fabs) ? window.appState.fabs : [];
    const fabObj = fabs.find(f =>
        window.cleanId(f.fabName || f.FabName || f.id || f.fabId || f.FabId) === window.cleanId(fabName)
    );
    if (!fabObj) return;

    // 防呆：使用者沒有交集角色就不允許切到該廠區
    if (currentUser) {
        const userRoleIds = (currentUser.assignedRoles || currentUser.AssignedRoles || []).map(window.cleanId);
        const fabRoleIds = (fabObj.assignedRoles || fabObj.AssignedRoles || []).map(window.cleanId);
        const canSee = fabRoleIds.length > 0 && fabRoleIds.some(r => userRoleIds.includes(r));
        if (!canSee) {
            if (typeof customAlert === 'function') customAlert('您沒有權限存取此廠區');
            return;
        }
    }

    window.currentFab = fabName;
    try { currentFab = fabName; } catch (e) { }

    const dLang = fabObj.defaultLang || fabObj.DefaultLang;
    if (dLang && typeof changeLanguage === 'function') {
        changeLanguage(dLang);
    }

    if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

    const isSystemSettings = window.currentActiveTopMenuId === 'system_settings';
    if (window.currentLayoutMode === 'system' && !isSystemSettings) {
        if (typeof goDefaultHome === 'function') {
            goDefaultHome();
        }
    }
};
// === 個人頁面管理 ===
//  - 主選單 (level 0) 才放在 tbody，DataTable 分頁只計主選單筆數（不含子選單）
//  - 主選單若有子選單，使用 DataTable row.child() 內嵌呈現
//  - 主選單拖曳影響上方導覽列順序；子選單拖曳影響側邊欄順序
//  - 顯示/隱藏 toggle、開啟方式下拉皆可即時生效
function renderPersonalMenuManage() {
    try {
        if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable('#dtPersonalMenu')) {
            $('#dtPersonalMenu').DataTable().destroy();
        }

        const tbody = document.getElementById('personalMenuTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!currentUser) return;

        const fabs = getFabs();
        const currentFabObj = fabs.find(f => window.cleanId(f.fabName || f.FabName) === window.cleanId(currentFab));
        if (!currentFabObj) return;

        const roles = getRoles();
        const menusData = getCustomMenus();
        const fabRoleIds = currentFabObj.assignedRoles || currentFabObj.AssignedRoles || [];
        const userRoleIds = currentUser.assignedRoles || currentUser.AssignedRoles || [];
        const activeRoleIds = (currentUser.roleLevel === 'admin')
            ? fabRoleIds
            : fabRoleIds.filter(id => userRoleIds.some(uId => window.cleanId(uId) === window.cleanId(id)));

        let initialMenuIds = [];
        activeRoleIds.forEach(roleId => {
            const role = roles.find(r => window.cleanId(r.id || r.RoleId) === window.cleanId(roleId));
            if (role && (role.allowedMenuIds || role.AllowedMenuIds)) {
                initialMenuIds.push(...(role.allowedMenuIds || role.AllowedMenuIds));
            }
        });

        let allowedIds = window.getAllowedIdsWithHierarchy(menusData, initialMenuIds);
        let menus = JSON.parse(JSON.stringify(menusData)).filter(m => allowedIds.has(m.id) && m.enabled !== false);
        let pSets = getPersonalSettings(currentUser.id);
        menus.forEach(m => {
            m.order = (pSets[m.id] && pSets[m.id].order != null) ? pSets[m.id].order : (m.order || 999);
        });
        menus.sort((a, b) => a.order - b.order);

        const noDrag = `onmouseenter="this.closest('tr').setAttribute('draggable', false)" onmouseleave="this.closest('tr').setAttribute('draggable', true)"`;

        // 將一個主選單列渲染成完整 TR HTML 字串
        const buildRowHtml = (menu, level, parentId) => {
            const pSet = pSets[menu.id] || {};
            const isHidden = pSet.hidden === true;
            const currentTarget = pSet.target || menu.target || 'iframe';
            const pad = level === 0 ? 'ps-3' : (level === 1 ? 'ps-5' : 'ps-5 ms-3');
            const children = menus.filter(m => m.parentId === menu.id || (m.parentIds && m.parentIds.includes(menu.id)));
            const hasChildren = children.length > 0;
            const isExpanded = expandedPerMenuIds.has(menu.id);

            const expandBtn = (level === 0 && hasChildren)
                ? `<span ${noDrag}><button type="button" onclick="togglePerMenuRow('${menu.id}')" class="chevron-btn text-secondary me-2 border-0 bg-transparent"><i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i></button></span>`
                : `<span class="chevron-btn text-muted me-2" style="cursor:default; opacity:0.3; padding:0 10px;"><i class="fas fa-minus"></i></span>`;

            const iconHtml = generateIconHtml(menu.icon, isHidden ? 'text-muted' : 'text-primary', 'me-2 fs-6', menu.menuMode === 'folder');
            const toggleHtml = `<div class="form-check form-switch m-0 d-flex justify-content-center" ${noDrag}><input class="form-check-input cursor-pointer" type="checkbox" onchange="togglePersonalProp('${menu.id}', 'hidden', !this.checked)" ${!isHidden ? 'checked' : ''} title="顯示/隱藏"></div>`;

            // 開啟方式：folder/有子選單者不顯示；leaf 才顯示下拉，可直接變更個人偏好
            const targetSelectHtml = hasChildren
                ? '<span class="text-muted">-</span>'
                : `<select class="form-select form-select-sm" ${noDrag} onchange="setPersonalTarget('${menu.id}', this.value)" style="max-width:140px; display:inline-block;">
                       <option value="iframe" ${currentTarget === 'iframe' ? 'selected' : ''}>畫面內嵌</option>
                       <option value="blank" ${currentTarget === 'blank' ? 'selected' : ''}>另開新分頁</option>
                       <option value="fullscreen" ${currentTarget === 'fullscreen' ? 'selected' : ''}>全螢幕</option>
                   </select>`;

            const trAttr = `draggable="true" ondragstart="handleDragStart(event, '${menu.id}', '${parentId || ''}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${menu.id}', '${parentId || ''}', 'personal')"`;
            const levelMap = { 0: '主選單', 1: '子選單', 2: '次子選單' };

            let dName = menu.displayName || menu.name || '未命名選單';
            if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + menu.id] && !menu.isEdited) {
                dName = i18n[currentLang]['dyn_' + menu.id];
            }

            const col1Html = `
                <div class="d-flex align-items-center">
                    <i class="fas fa-grip-vertical text-muted me-2" style="cursor: grab;" title="拖曳排序"></i>
                    ${expandBtn}
                    <div style="width:24px; text-align:center;">${iconHtml}</div>
                    <div class="ms-2 text-start lh-sm">
                        <div class="fw-bold text-dark ${isHidden ? 'text-decoration-line-through text-muted' : ''}">${dName}</div>
                    </div>
                </div>
            `;

            return `<tr ${trAttr} class="draggable-row ${isHidden ? 'opacity-50' : ''}" data-menu-id="${menu.id}" data-level="${level}">
                <td class="text-start ${pad} align-middle">${col1Html}</td>
                <td class="align-middle"><span class="badge badge-pill-outline px-3 text-secondary">${levelMap[level]}</span></td>
                <td class="align-middle">${toggleHtml}</td>
                <td class="text-start align-middle">${targetSelectHtml}</td>
                <td class="text-center align-middle" ${noDrag}><button class="action-btn edit btn btn-sm btn-outline-primary" onclick="editPersonalMenu('${menu.id}')"><i class="fas fa-edit"></i></button></td>
            </tr>`;
        };

        // 取得根層子選單（含遞迴的孫層）的展開 HTML（作為 row.child() 的內容）
        const buildSubtreeHtml = (rootId) => {
            const subRows = [];
            const walkChildren = (parentMenuId, level) => {
                const children = menus.filter(m => m.parentId === parentMenuId || (m.parentIds && m.parentIds.includes(parentMenuId)));
                children.sort((a, b) =>
                    ((a.parentOrders && a.parentOrders[parentMenuId] != null) ? a.parentOrders[parentMenuId] : (a.order || 0)) -
                    ((b.parentOrders && b.parentOrders[parentMenuId] != null) ? b.parentOrders[parentMenuId] : (b.order || 0))
                );
                children.forEach(c => {
                    subRows.push(buildRowHtml(c, level, parentMenuId));
                    walkChildren(c.id, level + 1);
                });
            };
            walkChildren(rootId, 1);
            if (subRows.length === 0) return '';
            return `<table class="table table-sm mb-0 bg-light"><tbody>${subRows.join('')}</tbody></table>`;
        };

        // 1) 先把主選單（level 0）寫入 tbody
        const rootMenus = menus.filter(m => m.isPoolItem === false && !m.parentId && (!m.parentIds || m.parentIds.length === 0));
        rootMenus.forEach(root => {
            tbody.innerHTML += buildRowHtml(root, 0, '');
        });

        // 2) 初始化 DataTable（分頁筆數只算主選單）
        if (typeof $ === 'undefined' || !$.fn || !$.fn.DataTable) return;
        setTimeout(() => {
            try {
                const dt = $('#dtPersonalMenu').DataTable({
                    language: {
                        "lengthMenu": "顯示 _MENU_ 筆主選單", "zeroRecords": "沒有符合的結果",
                        "info": "顯示第 _START_ 至 _END_ 筆，共 _TOTAL_ 筆主選單",
                        "infoEmpty": "顯示第 0 至 0 筆，共 0 筆", "infoFiltered": "(從 _MAX_ 筆結果過濾)",
                        "search": "<i class='fas fa-search text-muted me-1'></i> 搜尋:",
                        "paginate": { "first": "首頁", "previous": "上一頁", "next": "下一頁", "last": "尾頁" }
                    },
                    pageLength: 10, lengthMenu: [10, 25, 50, 100],
                    ordering: false, autoWidth: false, stateSave: false
                });
                dtInstances['dtPersonalMenu'] = dt;

                // 3) 為已展開的主選單附加 child rows
                expandedPerMenuIds.forEach(id => {
                    const tr = tbody.querySelector(`tr[data-menu-id="${id}"][data-level="0"]`);
                    if (!tr) return;
                    const row = dt.row(tr);
                    const html = buildSubtreeHtml(id);
                    if (html) row.child(html, 'personal-sub-row').show();
                });
            } catch (e) { console.error('[dtPersonalMenu] init error', e); }
        }, 50);
    } catch (err) {
        console.error("renderPersonalMenuManage error", err);
    }
}

// 顯示/隱藏：寫 LocalStorage + 自動同步至 DB
window.togglePersonalProp = function (menuId, prop, value) {
    let pSets = getPersonalSettings(currentUser.id);
    if (!pSets[menuId]) pSets[menuId] = {};
    pSets[menuId][prop] = value;
    savePersonalSettings(currentUser.id, pSets);
    if (typeof syncDataToDB === 'function') syncDataToDB();
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
};

// 個人模式下變更開啟方式（直接在表格的下拉變動即可）
window.setPersonalTarget = function (menuId, target) {
    let pSets = getPersonalSettings(currentUser.id);
    if (!pSets[menuId]) pSets[menuId] = {};
    pSets[menuId].target = target;
    savePersonalSettings(currentUser.id, pSets);
    if (typeof syncDataToDB === 'function') syncDataToDB();
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
};

// 列展開/收合（對齊舊版 togglePerMenuRow）
window.togglePerMenuRow = function (menuId) {
    if (expandedPerMenuIds.has(menuId)) expandedPerMenuIds.delete(menuId);
    else expandedPerMenuIds.add(menuId);
    isPerAllExpanded = false;
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
    // 對齊 TEST_20260429.html:3800 — 只列出「池中項目 (isPoolItem === true)」，依 order 排序
    const menus = getCustomMenus()
        .filter(m => String(m.isPoolItem || m.IsPoolItem).toLowerCase() === 'true')
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    menus.forEach(m => {
        const perms = window.getMenuPermissions(m.id || m.MenuId, m.createdBy || m.CreatedBy);
        if (!perms.canView) return;
        const mEnabled = m.enabled !== undefined ? m.enabled : (m.IsEnabled !== undefined ? m.IsEnabled : true);
        const mMode = m.menuMode || m.MenuMode; const mTarget = m.target || m.OpenTarget;
        const mUrl = m.url || m.Url || m.targetPage || m.TargetPage || '';
        const mIcon = m.icon || m.Icon; const mId = m.id || m.MenuId;
        const mDName = m.displayName || m.DisplayName; const mSysName = m.name || m.SysName;

        let statusBadge = mEnabled ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>';
        let typeBadge = mMode === 'app_grid'
            ? '<span class="badge bg-info text-dark border"><i class="fas fa-th-large"></i> 應用集合</span>'
            : '<span class="badge bg-light text-dark border"><i class="fas fa-link"></i> 網頁連結</span>';

        // 開啟模式（第一行）
        const targetMap = {
            'iframe': '<span class="text-secondary fw-bold small"><i class="fas fa-columns me-1"></i> 畫面內嵌</span>',
            'blank': '<span class="text-primary fw-bold small"><i class="fas fa-external-link-alt me-1"></i> 另開新分頁</span>',
            'fullscreen': '<span class="text-success fw-bold small"><i class="fas fa-expand me-1"></i> 全螢幕</span>'
        };
        const targetHtml = mMode === 'app_grid' ? '<span class="text-muted small">-</span>' : (targetMap[mTarget] || targetMap['iframe']);

        // 網址（第二行，完整顯示、會自動換行；word-break 避免長網址撐破版面）
        const urlHtml = mMode === 'app_grid'
            ? '<span class="text-success fw-bold small">內部應用集合區</span>'
            : (mUrl
                ? `<a href="${mUrl}" target="_blank" class="small text-decoration-none" style="word-break:break-all;"><i class="fas fa-info-circle text-secondary me-1"></i>${mUrl}</a>`
                : '<span class="text-muted small">無設定路徑</span>');

        const pathCellHtml = `
            <div class="d-flex flex-column align-items-start gap-1">
                <div>${targetHtml}</div>
                <div class="text-start" style="word-break:break-all;">${urlHtml}</div>
            </div>
        `;

        let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(mIcon, 'text-primary', 'me-2') : '';

        // 按鈕依權限顯示：admin / 自己建立 一律 OK；委派 user 需 canEditOthers
        let btnsHtml = '';
        if (perms.canEdit) {
            btnsHtml += `<button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); openAddWebpageModal('${mId}');" title="編輯"><i class="fas fa-edit"></i></button>`;
        }
        if (perms.canDelete) {
            btnsHtml += `<button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteWebpageItem('${mId}')" title="刪除"><i class="fas fa-trash-alt"></i></button>`;
        }
        if (!btnsHtml) btnsHtml = '<span class="badge bg-light text-muted border">僅檢視</span>';
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${btnsHtml}</div>`;

        tbody.innerHTML += `<tr class="draggable-row" draggable="true" ondragstart="handleDragStart(event, '${mId}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${mId}', null, 'webpage')"><td class="text-start ps-3 fw-bold text-dark align-middle"><i class="fas fa-grip-vertical text-muted me-2 opacity-50"></i>${iconHtml} ${mDName} <br><small class="text-muted fw-normal ms-4">${mSysName}</small></td><td class="align-middle">${typeBadge}</td><td class="align-middle">${statusBadge}</td><td class="text-start align-middle">${pathCellHtml}</td><td class="text-center align-middle" style="white-space: nowrap; width: 1%; vertical-align: middle;">${actionBtns}</td></tr>`;
    });
    initDataTable('dtWebpage', true);
}

function renderMenuConfigTable() {
    safeDestroyDataTable('dtMenuConfig'); const tbody = document.getElementById('menuConfigTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const menus = getCustomMenus();
    let roots = menus.filter(m => {
        if (String(m.isPoolItem || m.IsPoolItem).toLowerCase() === 'true') return false;
        let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId || m.ParentMenuId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
        return !hasValidParent;
    });
    // ⭐️ 依 getMenuPermissions().canView 過濾：admin 看全部；user 只能看自己建立 / 委派目錄 / 委派目錄的祖先
    roots = roots.filter(m => {
        const perms = window.getMenuPermissions(m.id || m.MenuId, m.createdBy || m.CreatedBy);
        return perms && perms.canView;
    });
    roots.sort((a, b) => (a.order || a.GlobalOrder || a.SortOrder || 0) - (b.order || b.GlobalOrder || b.SortOrder || 0));

    // ⭐️ 遞迴取得所有子孫節點的膠囊 UI (加入 visited 防止無窮迴圈崩潰！)
    function getDescendantBadges(parentId, allMenus, visited = new Set()) {
        if (visited.has(parentId)) return '';
        visited.add(parentId);

        let badges = '';
        // ⭐️ 修正處：將最後面的 { id parentId } 補上冒號變成 { id: parentId }
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

        const perms = window.getMenuPermissions(m.id || m.MenuId, m.createdBy || m.CreatedBy);
        let actionBtnsHtml = '';
        // 編輯：可編輯 或 可管理結構（後者讓被委派的祖先可以調整內部組合）
        if (perms.canEdit || perms.canManageStructure) {
            actionBtnsHtml += `<button type="button" class="btn btn-sm btn-outline-primary shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); openAddMenuNodeModal('${m.id}');" title="編輯"><i class="fas fa-edit"></i></button>`;
        }
        // 刪除：必須擁有 canDelete (admin / 自己 / 委派且 canEditOthers)
        if (perms.canDelete) {
            actionBtnsHtml += `<button type="button" class="btn btn-sm btn-outline-danger shadow-sm" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" onclick="event.stopPropagation(); deleteMenuNodeItem('${m.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>`;
        }
        if (!actionBtnsHtml) actionBtnsHtml = '<span class="badge bg-light text-muted border">僅檢視</span>';
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        const trAttr = `draggable="true" ondragstart="handleDragStart(event, '${m.id}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${m.id}', null, 'system')"`;

        let sysNameHtml = `
            <div class="d-flex align-items-center">
                <i class="fas fa-grip-vertical text-muted me-2 opacity-50" style="cursor:grab;"></i>
                <div>
                    <div class="fw-bold text-dark fs-6">${m.displayName}</div>
                    <div class="text-muted small">${m.name}</div>
                </div>
            </div>`;

        tbody.innerHTML += `
            <tr class="draggable-row" ${trAttr}>
                <td class="text-start ps-3 align-middle">${sysNameHtml}</td>
                <td class="align-middle">${typeBadge}</td>
                <td class="align-middle">${statusSwitch}</td>
                <td class="text-start align-middle" style="max-width: 400px; white-space: normal;">${contentTxt}</td>
                <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">${actionBtns}</td>
            </tr>`;
    });
    // 初始化 DataTables
    initDataTable('dtMenuConfig', true);
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
// === 廠區編輯時的「套用權限群組」勾選清單（對齊 TEST_20260429.html:1303）===
window.renderFabRoleCheckboxes = function (selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('fabRoleCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    getRoles().forEach(r => {
        const rId = r.id || r.roleId || r.RoleId || '';
        const rName = r.groupName || r.GroupName || rId;
        const isChecked = selectedIds.some(s => window.cleanId(s) === window.cleanId(rId)) ? 'checked' : '';
        container.innerHTML += `
            <div class="form-check form-check-inline border rounded px-3 py-1 bg-white mb-1 shadow-sm" style="border-color:#dee2e6 !important;">
                <input class="form-check-input ms-0 me-2 fab-role-cb cursor-pointer" type="checkbox" id="fr_${rId}" value="${rId}" ${isChecked}>
                <label class="form-check-label small fw-bold text-dark cursor-pointer" for="fr_${rId}">${rName}</label>
            </div>
        `;
    });
};

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

    // ⭐️ 勾選/取消勾選角色時，立刻刷新「管理目錄」清單與「各廠區預設首頁」
    if (!container.hasAttribute('data-roles-bound')) {
        container.setAttribute('data-roles-bound', '1');
        container.addEventListener('change', (e) => {
            if (!e.target.classList.contains('acc-role-cb')) return;
            // 保留目前勾選的管理目錄狀態
            const stillChecked = Array.from(document.querySelectorAll('.acc-menu-cb:checked')).map(cb => cb.value);
            if (typeof renderAccManageMenuCheckboxes === 'function') {
                renderAccManageMenuCheckboxes(stillChecked);
            }
            if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();
        });
    }
}

// 「管理目錄」清單：只列出「該帳號目前勾選的角色 → role.allowedMenuIds（含其下層）」中
// 屬於 folder 型的選單。沒選任何角色 / 沒對應的 folder → 顯示提示。
function renderAccManageMenuCheckboxes(selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('accManageMenuCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    // 取當前 modal 內已勾選的角色（即時讀 DOM，避免依賴外部傳入）
    const checkedRoleIds = Array.from(document.querySelectorAll('.acc-role-cb:checked')).map(cb => cb.value);
    const allMenus = getCustomMenus();

    if (checkedRoleIds.length === 0) {
        container.innerHTML = '<div class="text-warning small px-2 py-1"><i class="fas fa-exclamation-circle me-1"></i>請先在「可視群組版面」勾選至少一個角色，才能授權管理目錄</div>';
        return;
    }

    // 1) 從勾選角色蒐集 allowedMenuIds
    const roles = getRoles();
    let initialMenuIds = [];
    checkedRoleIds.forEach(rId => {
        const role = roles.find(r => window.cleanId(r.id || r.RoleId) === window.cleanId(rId));
        if (role && (role.allowedMenuIds || role.AllowedMenuIds)) {
            initialMenuIds.push(...(role.allowedMenuIds || role.AllowedMenuIds));
        }
    });

    // 2) 展開階層（包含子節點）
    const eligibleIds = window.getAllowedIdsWithHierarchy(allMenus, initialMenuIds);

    // 3) 篩選出「啟用 + 為 folder + 在 eligibleIds 內」
    const folderMenus = allMenus.filter(m =>
        (m.menuMode || m.MenuMode || '').toLowerCase() === 'folder' &&
        (m.enabled !== false && m.IsEnabled !== false) &&
        eligibleIds.has(m.id || m.MenuId)
    );

    if (folderMenus.length === 0) {
        container.innerHTML = '<div class="text-muted small px-2 py-1"><i class="fas fa-info-circle me-1 opacity-50"></i>所選角色在可視廠區內沒有可委派的主選單目錄</div>';
        return;
    }

    folderMenus.forEach(m => {
        const mId = m.id || m.MenuId || '';
        const mDName = m.displayName || m.DisplayName || '';
        const isChecked = selectedIds.some(s => window.cleanId(s) === window.cleanId(mId)) ? 'checked' : '';
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
    const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    fabs.forEach(f => {
        const fName = f.fabName || f.FabName || f.id || f.fabId || f.FabId || '';
        let defMenuId = tempDefaultPages[fName];
        let defMenuObj = menus.find(m => window.cleanId(m.id || m.MenuId) === window.cleanId(defMenuId));
        let displayTxt = defMenuObj ? getFullMenuPathStr(defMenuId, menus) : '系統自動抓取第一個可視看板';
        let txtColor = defMenuObj ? 'text-success fw-bold' : 'text-muted';

        // 使用 data-fab + addEventListener 取代 inline onclick，避免名稱含引號時注入
        html += `
            <div class="d-flex align-items-center mb-2 border-bottom pb-2">
                <span class="badge bg-secondary me-2" style="width: 45px;">${fName}</span>
                <span class="flex-grow-1 text-truncate small ${txtColor}" id="def_text_${escAttr(fName)}">預設：${displayTxt}</span>
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-3 fw-bold rounded-pill shadow-sm js-pick-default" data-fab="${escAttr(fName)}">指定</button>
                <button type="button" class="btn btn-sm btn-outline-danger border-0 py-0 px-2 ms-1 js-clear-default" data-fab="${escAttr(fName)}" title="清除設定"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
    container.innerHTML = html;

    if (!container.hasAttribute('data-bound')) {
        container.setAttribute('data-bound', '1');
        container.addEventListener('click', function (e) {
            const pickBtn = e.target.closest('.js-pick-default');
            const clearBtn = e.target.closest('.js-clear-default');
            if (pickBtn) {
                const fab = pickBtn.getAttribute('data-fab');
                if (typeof openMenuSelector === 'function') openMenuSelector(fab);
            } else if (clearBtn) {
                const fab = clearBtn.getAttribute('data-fab');
                if (typeof clearDefaultMenu === 'function') clearDefaultMenu(fab);
            }
        });
    }
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

        // 同步回 AppState 並自動寫入 DB
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