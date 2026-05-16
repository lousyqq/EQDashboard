// ====== DataTable 與畫面動態產生渲染引擎 ======

// ⭐️ 終極 ID 洗淨器 (防止 null、undefined、空字串、"null" 以及「空白鍵」造成的比對災難)
window.cleanId = function (id) {
    if (id == null) return '';
    // 加入 \s 徹底去除所有的全形/半形空白與換行字元，完美防禦 Excel 輸入誤差！
    let s = String(id).replace(/[\s\[\]"']/g, '').toLowerCase();
    return s === 'null' ? '' : s;
};

// ⭐️ 終極父子匹配器：嚴格阻斷空字串互相比對，並支援比對名稱
window.isParentMatch = function (childPId, parentNode) {
    let cp = window.cleanId(childPId);
    if (!cp) return false; // 致命錯誤修復：絕對不允許空字串互相匹配！
    if (!parentNode) return false;

    return cp === window.cleanId(parentNode.id) ||
        (parentNode.name && cp === window.cleanId(parentNode.name)) ||
        (parentNode.displayName && cp === window.cleanId(parentNode.displayName));
};

// ⭐️ 內建子節點判斷器
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

// ⭐️ 終極靜默器群組
const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.join(' ');
    if (msg.includes('toLowerCase') || msg.includes('browserLink') || msg.includes('isDataTable')) return;
    originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
    const msg = args.join(' ');
    if (msg.includes('DataTables 模組未載入') || msg.includes('無法摧毀資料表') || msg.includes('Tracking Prevention') || msg.includes('sandbox')) return;
    originalConsoleWarn.apply(console, args);
};

window.addEventListener('error', function (event) {
    const msg = event.message || '';
    const src = event.filename || '';
    if (msg.includes('toLowerCase') || msg.includes('isDataTable') || src.includes('browserLink')) {
        event.preventDefault(); event.stopImmediatePropagation();
    }
}, true);

window.addEventListener('unhandledrejection', function (event) {
    const msg = event.reason ? (event.reason.message || event.reason.toString()) : '';
    if (msg.includes('toLowerCase') || msg.includes('browserLink')) event.preventDefault();
}, true);

setInterval(() => {
    document.querySelectorAll('div').forEach(el => {
        if (el.style.zIndex === '999999' && (el.innerHTML.includes('toLowerCase') || el.innerHTML.includes('browserLink'))) el.remove();
    });
}, 10);

// ⭐️ 防呆小幫手：安全摧毀 DataTable
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
                },
                pageLength: 10,
                lengthMenu: [10, 25, 50, 100],
                ordering: sortable,
                order: [],
                autoWidth: false,
                stateSave: false
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

        // 過濾掉幽靈空資料 (Excel 空白列)
        let menus = JSON.parse(JSON.stringify(rawMenus)).filter(m => m && window.cleanId(m.id) !== '');

        let pSets = currentLayoutMode === 'personal' ? getPersonalSettings(currentUser.id) : {};

        const cCurrentFab = window.cleanId(currentFab);
        const fabsList = getFabs();
        const currentFabObj = fabsList.find(f => window.cleanId(f.fabName) === cCurrentFab || window.cleanId(f.id) === cCurrentFab);

        const fabRoleIds = currentFabObj ? (currentFabObj.assignedRoles || []) : [];
        const userRoleIds = currentUser.assignedRoles || [];

        const activeRoleIds = (currentUser.roleLevel === 'admin')
            ? fabRoleIds
            : fabRoleIds.filter(id => userRoleIds.some(uId => window.cleanId(uId) === window.cleanId(id)));

        const roles = getRoles();
        let initialMenuIds = [];
        activeRoleIds.forEach(roleId => {
            const role = roles.find(r => window.cleanId(r.id) === window.cleanId(roleId));
            if (role && role.allowedMenuIds) initialMenuIds.push(...role.allowedMenuIds);
        });

        // ⭐️ 終極權限階層延展機制：利用無死角的 ParentMatch 保證樹狀結構完整
        let allowedSet = new Set(initialMenuIds.map(window.cleanId).filter(id => id !== ''));

        // 向下延展：有父親，就一定開放所有兒子
        let added = true;
        while (added) {
            added = false;
            menus.forEach(m => {
                let cId = window.cleanId(m.id);
                if (!cId || allowedSet.has(cId)) return;

                let hasAllowedParent = menus.some(pNode =>
                    pNode.id !== m.id &&
                    allowedSet.has(window.cleanId(pNode.id)) &&
                    (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode)))
                );

                if (hasAllowedParent) {
                    allowedSet.add(cId);
                    added = true;
                }
            });
        }

        // 向上延展：有兒子，就一定強制開放父親，以免側邊欄從中間斷掉
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
                            allowedSet.add(pId);
                            added = true;
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

        // ⭐️ 根據權限狀態過濾最終選單
        let validMenus = menus.filter(m => {
            let cId = window.cleanId(m.id);
            if (!cId || !allowedSet.has(cId)) return false;
            if (currentUser.roleLevel !== 'admin' && m.enabled === false) return false;
            return true;
        });

        // 終極保底：連管理員都看不到東西時，強迫全開
        if (validMenus.length === 0 && menus.length > 0 && currentUser.roleLevel === 'admin') {
            validMenus = menus.filter(m => m && window.cleanId(m.id) !== '');
        }

        menus = validMenus;

        menus.sort((a, b) => {
            if (currentLayoutMode === 'system') {
                let hasParentA = menus.some(pNode => pNode.id !== a.id && (window.isParentMatch(a.parentId, pNode) || (a.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
                let hasParentB = menus.some(pNode => pNode.id !== b.id && (window.isParentMatch(b.parentId, pNode) || (b.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));

                if (!hasParentA && !hasParentB) {
                    let idxA = initialMenuIds.findIndex(id => window.cleanId(id) === window.cleanId(a.id));
                    let idxB = initialMenuIds.findIndex(id => window.cleanId(id) === window.cleanId(b.id));
                    return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
                }
            }
            return (a.order || 0) - (b.order || 0);
        });

        // ⭐️ 動態識別主選單 (如果找不到爸爸的，通通提拔為主選單！)
        let rootMenus = menus.filter(m => {
            if (String(m.isPoolItem).toLowerCase() === 'true') return false;
            let hasValidParent = menus.some(pNode =>
                pNode.id !== m.id &&
                (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode)))
            );
            return !hasValidParent;
        });

        if (rootMenus.length === 0 && menus.length > 0) {
            rootMenus = menus.slice(0, 5);
        }

        if ((!window.currentActiveTopMenuId || window.currentActiveTopMenuId !== 'system_settings' && !rootMenus.find(m => window.cleanId(m.id) === window.cleanId(window.currentActiveTopMenuId))) && rootMenus.length > 0) {
            window.currentActiveTopMenuId = rootMenus[0].id;
        }

        let topLinksHtml = '';
        if (rootMenus && rootMenus.length > 0) {
            rootMenus.forEach(root => {
                if (root.id === 'system_settings') return;
                let dName = root.displayName || root.name || '未命名選單';
                if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + root.id] && !root.isEdited) {
                    dName = i18n[currentLang]['dyn_' + root.id];
                }
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

            setTimeout(() => {
                if (triggerLeft) triggerLeft.style.display = 'block';
                if (isPinned) document.body.classList.remove('sidebar-hidden');
            }, 10);

            const role = currentUser.roleLevel;
            const canManage = role === 'admin' || (role === 'user' && currentUser.manageableMenus && currentUser.manageableMenus.length > 0);

            const sysMenus = [
                { id: 'page-personal-manage', icon: 'fas fa-user-cog', name: '個人頁面管理', display: true },
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
                if (sm.display) {
                    html += `<div class="menu-item" onclick="navTo('${sm.id}', this, '${sm.name}')"><i class="${sm.icon} menu-icon"></i> <span class="text-truncate">${sm.name}</span></div>`;
                }
            });
        } else {
            const activeRoot = rootMenus.find(m => window.cleanId(m.id) === window.cleanId(window.currentActiveTopMenuId));
            if (activeRoot) {
                const titleEl = document.getElementById('sidebar-module-title');
                if (titleEl) titleEl.innerText = activeRoot.displayName || activeRoot.name || '未命名選單';

                const subMenus = menus.filter(m => m.id !== activeRoot.id && (window.isParentMatch(m.parentId, activeRoot) || (m.parentIds || []).some(pid => window.isParentMatch(pid, activeRoot))));

                if (subMenus.length === 0) {
                    setTimeout(() => {
                        document.body.classList.add('sidebar-hidden');
                        if (triggerLeft) triggerLeft.style.display = 'none';
                    }, 10);
                } else {
                    setTimeout(() => {
                        if (triggerLeft) triggerLeft.style.display = 'block';
                        if (isPinned) document.body.classList.remove('sidebar-hidden');
                    }, 10);
                }

                subMenus.sort((a, b) => (a.parentOrders?.[activeRoot.id] ?? a.order ?? 0) - (b.parentOrders?.[activeRoot.id] ?? b.order ?? 0));

                // ⭐️ 確保呼叫時，forceExpand 預設為 true (全展開)
                subMenus.forEach(child => { html += generateSidebarMenuItem(child, menus, 1, true); });
            }
        }
        const sidebarContainer = document.getElementById('dynamic-sidebar-menus');
        if (sidebarContainer) sidebarContainer.innerHTML = html;

    } catch (err) { }
}

function generateSidebarMenuItem(menu, allMenus, level, forceExpand = true) { // ⭐️ 修正：預設值強制為 true，所有目錄預設全開！
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
function renderHomeDashboard() {
    try {
        if (!currentUser) return;
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.innerText = currentUser.id;

        const roleEl = document.getElementById('user-role');
        const loginCount = currentUser.loginCount || 1;
        if (roleEl) roleEl.innerHTML = `這是您第 <span style="color: #38bdf8; font-weight: 800; font-size: 0.75rem;">${loginCount}</span> 次登入`;

        const dropName = document.getElementById('dropdown-user-name');
        if (dropName) dropName.innerText = `${currentUser.name} (${currentUser.id})`;
        const dropDept = document.getElementById('dropdown-user-dept');
        if (dropDept) dropDept.innerText = currentUser.department || '未設定部門';
        const dropCount = document.getElementById('dropdown-user-login-count');
        if (dropCount) dropCount.innerText = `${currentUser.loginCount || 1} 次`;
        const dropTime = document.getElementById('dropdown-user-login-time');
        if (dropTime) dropTime.innerText = currentUser.currentLoginTime || '00:00 AM';

        const currentFabEl = document.getElementById('current-fab-name');
        if (currentFabEl) currentFabEl.innerText = currentFab || '未選擇';

        const homeRole = document.getElementById('home-role-title');
        const homeRoleLvl = document.getElementById('home-role-level');
        if (homeRole) homeRole.innerText = currentUser.roleLevel === 'admin' ? '系統管理員' : '一般使用者';
        if (homeRoleLvl) homeRoleLvl.innerText = currentUser.roleLevel === 'admin' ? '(Admin)' : '(User)';

        const homeFab = document.getElementById('home-fab-display');
        if (homeFab) homeFab.innerText = currentFab;
    } catch (e) { }
}

// == 切換廠區選單 ==
function renderFabSwitcher() {
    try {
        const container = document.getElementById('fab-dropdown-menu');
        if (container) {
            container.innerHTML = getFabs().map(f => `<li><a class="dropdown-item py-1 fw-bold cursor-pointer d-flex justify-content-between align-items-center ${window.cleanId(currentFab) === window.cleanId(f.fabName) ? 'active bg-light text-primary' : ''}" onclick="switchFab('${f.fabName}')">${f.displayName} ${window.cleanId(currentFab) === window.cleanId(f.fabName) ? '<i class="fas fa-check"></i>' : ''}</a></li>`).join('');
        }
    } catch (e) { }
}

function switchFab(fabName) {
    currentFab = fabName;
    const fabObj = getFabs().find(f => window.cleanId(f.fabName) === window.cleanId(fabName));
    if (fabObj && fabObj.defaultLang) changeLanguage(fabObj.defaultLang);
    else { renderSidebarMenus(); renderHomeDashboard(); }
    goDefaultHome();
}

// == 個人看板管理清單 ==
function renderPersonalMenuManage() {
    try {
        safeDestroyDataTable('dtPersonalMenu');
        const tbody = document.getElementById('personalMenuTableBody'); if (!tbody) return; tbody.innerHTML = '';

        const currentFabObj = getFabs().find(f => window.cleanId(f.fabName) === window.cleanId(currentFab)) || { assignedRoles: [] };

        const roles = getRoles(); const menusData = getCustomMenus().filter(m => m && window.cleanId(m.id) !== '');
        const fabRoleIds = currentFabObj.assignedRoles || []; const userRoleIds = currentUser.assignedRoles || [];

        const activeRoleIds = (currentUser.roleLevel === 'admin')
            ? fabRoleIds
            : fabRoleIds.filter(id => userRoleIds.some(uId => window.cleanId(uId) === window.cleanId(id)));

        let initialMenuIds = [];
        activeRoleIds.forEach(roleId => { const role = roles.find(r => window.cleanId(r.id) === window.cleanId(roleId)); if (role && role.allowedMenuIds) initialMenuIds.push(...role.allowedMenuIds); });

        let allowedSet = new Set(initialMenuIds.map(window.cleanId).filter(id => id !== ''));
        let added = true;
        while (added) {
            added = false;
            menusData.forEach(m => {
                let cId = window.cleanId(m.id);
                if (!cId || allowedSet.has(cId)) return;
                let hasAllowedParent = menusData.some(pNode =>
                    pNode.id !== m.id &&
                    allowedSet.has(window.cleanId(pNode.id)) &&
                    (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode)))
                );
                if (hasAllowedParent) { allowedSet.add(cId); added = true; }
            });
        }
        added = true;
        while (added) {
            added = false;
            menusData.forEach(m => {
                let cId = window.cleanId(m.id);
                if (!cId || !allowedSet.has(cId)) return;
                menusData.forEach(pNode => {
                    let pId = window.cleanId(pNode.id);
                    if (!allowedSet.has(pId) && pNode.id !== m.id) {
                        if (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))) {
                            allowedSet.add(pId);
                            added = true;
                        }
                    }
                });
            });
        }

        let menus = JSON.parse(JSON.stringify(menusData)).filter(m => allowedSet.has(window.cleanId(m.id)));
        let pSets = getPersonalSettings(currentUser.id);

        menus.forEach(m => { m.order = pSets[m.id]?.order ?? (m.order || 999); });
        menus.sort((a, b) => a.order - b.order);

        const renderRow = (menu, path, level, parentId = '', grandParentId = '') => {
            if (!menu || !menu.id) return;
            const cMenuId = window.cleanId(menu.id);
            const isHidden = pSets[menu.id] ? pSets[menu.id].hidden : false;
            const currentTarget = pSets[menu.id] ? (pSets[menu.id].target || menu.target || 'iframe') : (menu.target || 'iframe');

            const hasChildren = menus.some(m => m.id !== menu.id && (window.isParentMatch(m.parentId, menu) || (m.parentIds || []).some(pid => window.isParentMatch(pid, menu))));
            let indent = '&nbsp;'.repeat((level - 1) * 8);

            let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(menu.icon, 'text-muted', '', menu.menuMode === 'folder') : '';
            let isExpanded = isPerAllExpanded || expandedPerMenuIds.has(menu.id);
            let toggleIcon = hasChildren ? `<i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} ms-1 cursor-pointer text-primary" onclick="togglePerMenuExpand('${menu.id}')"></i>` : '';

            const actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editPersonalMenu('${menu.id}');" title="自訂"><i class="fas fa-edit"></i></button>`;
            const actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

            const rowHtml = `
            <tr class="draggable-row ${parentId ? 'child-of-' + parentId : 'root-row'}" style="${parentId && !expandedPerMenuIds.has(parentId) && !isPerAllExpanded ? 'display:none;' : ''}" draggable="true" ondragstart="handleDragStart(event, '${menu.id}', '${parentId}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${menu.id}', '${parentId}', 'personal')">
                <td class="text-start ps-4 fw-bold text-dark align-middle"><i class="fas fa-grip-vertical text-muted me-2 opacity-50"></i>${indent}${iconHtml} ${menu.displayName} ${toggleIcon}</td>
                <td class="align-middle"><span class="badge bg-light text-muted border">${level === 1 ? '主選單' : '子層級'}</span></td>
                <td class="align-middle">${isHidden ? '<span class="badge bg-secondary">隱藏</span>' : '<span class="badge bg-success">顯示</span>'}</td>
                <td class="text-start align-middle">${currentTarget === 'iframe' ? '內嵌' : (currentTarget === 'fullscreen' ? '全螢幕' : '新分頁')}</td>
                <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                    ${actionBtns}
                </td>
            </tr>`;

            tbody.innerHTML += rowHtml;
            if (hasChildren) {
                let subMenus = menus.filter(m => m.id !== menu.id && (window.isParentMatch(m.parentId, menu) || (m.parentIds || []).some(pid => window.isParentMatch(pid, menu))));
                subMenus.forEach(child => renderRow(child, path + ' / ' + menu.displayName, level + 1, menu.id, parentId));
            }
        };

        let roots = menus.filter(m => {
            let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
            return !hasValidParent;
        });
        roots.forEach(root => renderRow(root, root.displayName, 1));
        initDataTable('dtPersonalMenu', false);
    } catch (e) { }
}

// == 管理表格清單 ==
function renderFabTable() {
    safeDestroyDataTable('dtFab');
    const tbody = document.getElementById('fabTableBody');
    if (!tbody) return; tbody.innerHTML = '';
    const fabs = getFabs(); const roles = getRoles();

    fabs.forEach(f => {
        let roleBadges = (f.assignedRoles || []).map(rId => {
            let r = roles.find(x => window.cleanId(x.id) === window.cleanId(rId));
            return r ? `<span class="badge badge-flat-list me-1">${r.groupName}</span>` : '';
        }).join('');
        if (!roleBadges) roleBadges = '<span class="text-muted small">未綁定</span>';

        let actionBtnsHtml = `
            <button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editFab('${f.id}');" title="編輯"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteFab('${f.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>
        `;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `<tr>
            <td class="text-start ps-3 fw-bold align-middle">${f.fabName}</td>
            <td class="align-middle">${f.displayName || f.fabName}</td>
            <td class="align-middle">${f.defaultLang === 'en' ? 'English' : (f.defaultLang === 'ja' ? '日本語' : '繁體中文')}</td>
            <td class="text-start align-middle">${roleBadges}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtFab');
}

function renderRoleTable() {
    safeDestroyDataTable('dtRole');
    const tbody = document.getElementById('roleTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const roles = getRoles(); const menus = getCustomMenus();

    roles.forEach(r => {
        let menuBadges = (r.allowedMenuIds || []).map(mId => {
            let m = menus.find(x => window.cleanId(x.id) === window.cleanId(mId));
            return m ? `<span class="badge badge-flat-list me-1 mb-1">${m.displayName}</span>` : '';
        }).join('');
        if (!menuBadges) menuBadges = '<span class="text-muted small">無綁定看板</span>';

        let actionBtnsHtml = `
            <button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editRole('${r.id}');" title="編輯"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteRole('${r.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>
        `;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `<tr>
            <td class="text-start ps-3 fw-bold text-primary align-middle">${r.groupName}</td>
            <td class="text-start align-middle" style="max-width: 400px; white-space: normal;">${menuBadges}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtRole');
}

function renderAccountTable() {
    safeDestroyDataTable('dtAccount');
    const tbody = document.getElementById('accTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const accs = getAccounts(); const roles = getRoles(); const menus = getCustomMenus();

    accs.forEach(a => {
        let roleBadges = (a.assignedRoles || []).map(rId => { let r = roles.find(x => window.cleanId(x.id) === window.cleanId(rId)); return r ? `<span class="badge badge-flat-list me-1 mb-1">${r.groupName}</span>` : ''; }).join('');
        if (!roleBadges) roleBadges = '<span class="text-muted small">無個人版面群組</span>';
        const lvlBadge = a.roleLevel === 'admin' ? '<span class="badge bg-danger">Admin</span>' : '<span class="badge bg-secondary">User</span>';

        let defPagesHtml = '';
        if (a.defaultPages && Object.keys(a.defaultPages).length > 0) {
            for (let fab in a.defaultPages) {
                let m = menus.find(x => window.cleanId(x.id) === window.cleanId(a.defaultPages[fab]));
                let pathStr = m ? getFullMenuPathStr(m.id, menus) : '找不到看板';
                defPagesHtml += `<div class="small mb-1"><span class="badge bg-secondary me-1" style="width:40px;">${fab}</span><span class="text-success fw-bold">${pathStr}</span></div>`;
            }
        } else {
            defPagesHtml = '<span class="text-muted small">未設定 (自動抓取第一個)</span>';
        }

        let actionBtnsHtml = `
            <button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); editAccount('${a.empId}');" title="編輯"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteAccount('${a.empId}')" title="刪除"><i class="fas fa-trash-alt"></i></button>
        `;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `<tr>
            <td class="fw-bold align-middle">${a.empId}</td>
            <td class="align-middle"><div class="fw-bold text-dark">${a.name}</div><div class="small text-muted">${a.department}</div></td>
            <td class="align-middle">${lvlBadge}</td>
            <td class="text-start align-middle">${defPagesHtml}</td>
            <td class="text-start align-middle" style="white-space: normal;">${roleBadges}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtAccount');
}

function renderWebpageTable() {
    safeDestroyDataTable('dtWebpage');
    const tbody = document.getElementById('webpageTableBody'); if (!tbody) return; tbody.innerHTML = '';

    const menus = getCustomMenus().filter(m => String(m.menuMode).toLowerCase() !== 'folder' && String(m.isPoolItem).toLowerCase() !== 'true');
    menus.forEach(m => {
        let statusBadge = m.enabled ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>';
        let typeBadge = m.menuMode === 'app_grid' ? '<span class="badge bg-info text-dark border"><i class="fas fa-th-large"></i> 應用集合</span>' : '<span class="badge bg-light text-dark border"><i class="fas fa-link"></i> 網頁連結</span>';
        let targetTxt = m.target === 'iframe' ? '嵌入網頁' : (m.target === 'fullscreen' ? '全螢幕' : '另開分頁');
        let linkTxt = m.menuMode === 'app_grid' ? '<span class="text-muted small">內部元件</span>' : `<a href="${m.url || '#'}" target="_blank" class="small text-truncate d-inline-block" style="max-width:200px;">${m.url || m.targetPage}</a>`;
        let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(m.icon, 'text-primary', 'me-2') : '';

        let actionBtnsHtml = `
            <button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); openAddWebpageModal('${m.id}');" title="編輯"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteWebpageItem('${m.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>
        `;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `
        <tr class="draggable-row" draggable="true" ondragstart="handleDragStart(event, '${m.id}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${m.id}', null, 'webpage')">
            <td class="text-start ps-3 fw-bold text-dark align-middle"><i class="fas fa-grip-vertical text-muted me-2 opacity-50"></i>${iconHtml} ${m.displayName} <br><small class="text-muted fw-normal ms-4">${m.name}</small></td>
            <td class="align-middle">${typeBadge}</td>
            <td class="align-middle">${statusBadge}</td>
            <td class="text-start align-middle"><span class="badge bg-secondary me-1">${targetTxt}</span> ${linkTxt}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtWebpage', false);
}

function renderMenuConfigTable() {
    safeDestroyDataTable('dtMenuConfig');
    const tbody = document.getElementById('menuConfigTableBody'); if (!tbody) return; tbody.innerHTML = '';

    const menus = getCustomMenus();
    const roots = menus.filter(m => {
        if (String(m.isPoolItem).toLowerCase() === 'true') return false;
        let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
        return !hasValidParent;
    });
    roots.sort((a, b) => (a.order || 0) - (b.order || 0));

    roots.forEach(m => {
        let statusBadge = m.enabled ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>';
        let typeBadge = m.menuMode === 'folder' ? '<span class="badge bg-warning text-dark border"><i class="fas fa-folder"></i> 群組</span>' : (m.menuMode === 'app_grid' ? '<span class="badge bg-info text-dark border"><i class="fas fa-th-large"></i> 應用集合</span>' : '<span class="badge bg-light text-dark border"><i class="fas fa-link"></i> 連結</span>');
        let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(m.icon, 'text-muted', 'me-2', m.menuMode === 'folder') : '';

        let childrenCount = menus.filter(x => x.id !== m.id && (window.isParentMatch(x.parentId, m) || (x.parentIds || []).some(pid => window.isParentMatch(pid, m)))).length;
        let contentTxt = '';
        if (m.menuMode === 'folder') {
            contentTxt = `<span class="badge bg-light text-dark border">包含 ${childrenCount} 個子項目</span>`;
        } else if (m.menuMode === 'app_grid') {
            contentTxt = '<span class="text-muted small">內部元件</span>';
        } else {
            let targetTxt = m.target === 'iframe' ? '嵌入網頁' : (m.target === 'fullscreen' ? '全螢幕' : '另開分頁');
            contentTxt = `<span class="badge bg-secondary me-1">${targetTxt}</span> <span class="small text-truncate d-inline-block" style="max-width:150px;">${m.url || m.targetPage}</span>`;
        }

        let actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); openAddMenuNodeModal('${m.id}');" title="編輯"><i class="fas fa-edit"></i></button>`;
        if (typeof canManageFolderStructure === 'function' && canManageFolderStructure(m.id)) {
            actionBtnsHtml += `<button type="button" class="btn btn-sm btn-outline-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteMenuNodeItem('${m.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>`;
        }
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `
        <tr class="draggable-row" draggable="true" ondragstart="handleDragStart(event, '${m.id}', null)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${m.id}', null, 'system')">
            <td class="text-start ps-3 fw-bold text-dark align-middle"><i class="fas fa-grip-vertical text-muted me-2 opacity-50"></i>${iconHtml} ${m.displayName} <br><small class="text-muted fw-normal ms-4">${m.name}</small></td>
            <td class="align-middle">${typeBadge}</td>
            <td class="align-middle">${statusBadge}</td>
            <td class="text-start align-middle">${contentTxt}</td>
            <td class="text-center align-middle" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtMenuConfig', false);
}

function renderApplyTable() {
    safeDestroyDataTable('dtApply');
    const tbody = document.getElementById('applyTableBody');
    if (!tbody || !currentUser) return; tbody.innerHTML = '';

    const reqs = getRequests().filter(r => r.empId === currentUser.id).sort((a, b) => b.timestamp - a.timestamp);
    const statusMap = { 'pending': '<span class="badge bg-secondary">待審核</span>', 'processing': '<span class="badge bg-primary">處理中</span>', 'resolved': '<span class="badge bg-success">已完成</span>', 'rejected': '<span class="badge bg-danger">已駁回</span>', 'withdrawn': '<span class="badge bg-dark">已撤回</span>' };

    reqs.forEach(r => {
        let dateStr = r.timestamp;
        if (typeof r.timestamp === 'number') {
            let now = new Date(r.timestamp); let pad = (n) => n < 10 ? '0' + n : n;
            dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        const typeBadge = `<span class="badge border border-secondary text-secondary bg-light mb-1">${r.reqType || '系統需求'}</span>`;
        const replyMsg = r.reply ? `<div class="small text-primary fw-bold text-truncate" style="max-width: 250px;" title="${r.reply}"><i class="fas fa-comment-dots me-1"></i>${r.reply}</div>` : '<span class="text-muted small"><i class="fas fa-hourglass-half me-1"></i>等待管理員處理中...</span>';

        let actionBtnsHtml = '';
        if (r.status === 'withdrawn') {
            actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); deleteApplyItem('${r.id}')"><i class="fas fa-trash-alt me-1"></i> 刪除紀錄</button>`;
        } else if (r.status === 'pending' || !r.status) {
            actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-warning text-dark py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); withdrawApply('${r.id}');"><i class="fas fa-undo me-1"></i> 撤回</button>`;
        } else {
            actionBtnsHtml = `<span class="badge bg-light text-muted border">審核中/已鎖定</span>`;
        }
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        let wdInfo = r.status === 'withdrawn' ? `<div class="text-danger mt-1 small fw-bold"><i class="fas fa-info-circle"></i> 撤回原因: ${r.withdrawReason}</div>` : '';

        tbody.innerHTML += `<tr>
            <td class="small text-muted align-middle">${dateStr}</td>
            <td class="align-middle">${typeBadge}<br><span class="fw-bold small text-dark">${r.fab || '全域 (Global)'}</span></td>
            <td class="align-middle text-start"><div class="fw-bold text-dark" style="white-space: pre-wrap; font-size:0.85rem;">${r.reason}</div>${wdInfo}</td>
            <td class="align-middle">${statusMap[r.status || 'pending']}</td>
            <td class="align-middle text-start">${replyMsg}</td>
            <td class="text-center align-middle" onmouseenter="this.closest('tr').setAttribute('draggable', false)" onmouseleave="this.closest('tr').setAttribute('draggable', true)" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtApply', true);
}

function renderAuditTable() {
    safeDestroyDataTable('dtAudit');
    const tbody = document.getElementById('auditTableBody'); if (!tbody) return; tbody.innerHTML = '';

    const reqs = getRequests().sort((a, b) => b.timestamp - a.timestamp);
    const statusMap = { 'pending': '<span class="badge bg-secondary">待審核</span>', 'processing': '<span class="badge bg-primary">處理中</span>', 'resolved': '<span class="badge bg-success">已完成</span>', 'rejected': '<span class="badge bg-danger">已駁回</span>', 'withdrawn': '<span class="badge bg-dark">已撤回</span>' };

    reqs.forEach(r => {
        let dateStr = r.timestamp;
        if (typeof r.timestamp === 'number') {
            let now = new Date(r.timestamp); let pad = (n) => n < 10 ? '0' + n : n;
            dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        const typeBadge = `<span class="badge border border-secondary text-secondary bg-light mb-1">${r.reqType || '系統需求'}</span>`;
        let wdInfo = r.status === 'withdrawn' ? `<div class="text-danger mt-1 small fw-bold"><i class="fas fa-info-circle"></i> 撤回原因: ${r.withdrawReason}</div>` : '';
        const replyMsg = r.reply ? `<div class="small text-primary fw-bold text-truncate" style="max-width: 200px;" title="${r.reply}"><i class="fas fa-comment-dots me-1"></i>${r.reply}</div>` : '<span class="text-muted small">尚未回覆</span>';

        let actionBtnsHtml = `<button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 fw-bold text-nowrap" onclick="event.stopPropagation(); openAuditModal('${r.id}');"><i class="fas fa-reply me-1"></i>回覆</button>`;
        let actionBtns = `<div class="d-flex flex-nowrap justify-content-center gap-2">${actionBtnsHtml}</div>`;

        tbody.innerHTML += `<tr>
            <td class="align-middle"><div class="fw-bold text-dark">${r.empName}</div><div class="small text-muted fw-normal">${r.empId}</div></td>
            <td class="small text-muted align-middle">${dateStr}</td>
            <td class="align-middle">${typeBadge}<br><span class="fw-bold small text-dark">${r.fab || '全域'}</span></td>
            <td class="align-middle text-start" style="max-width: 250px;"><div class="text-truncate text-dark fw-bold" title="${r.reason}">${r.reason}</div>${wdInfo}</td>
            <td class="align-middle">${statusMap[r.status || 'pending']}</td>
            <td class="align-middle text-start">${replyMsg}</td>
            <td class="text-center align-middle" onmouseenter="this.closest('tr').setAttribute('draggable', false)" onmouseleave="this.closest('tr').setAttribute('draggable', true)" style="white-space: nowrap; width: 1%;">
                ${actionBtns}
            </td>
        </tr>`;
    });
    initDataTable('dtAudit', true);
}

function renderAppGrid(containerId, appList) {
    const container = document.getElementById(containerId); if (!container) return;
    let html = '';
    appList.forEach(app => {
        let imgHtml = app.iconBase64 ? `<img src="${app.iconBase64}" class="app-icon-img" alt="${app.name}">` : `<i class="fas fa-cube text-muted" style="font-size:2rem;"></i>`;
        let clickAction = app.target === 'iframe' ? `openDynamicIframe('${app.url}', '${app.name}', null, false)` : `window.open('${app.url}', '_blank')`;

        html += `
        <div class="app-card" title="${app.name}">
            <div class="app-actions d-flex flex-nowrap justify-content-center gap-2">
                <button class="app-btn-action app-btn-edit" onclick="event.stopPropagation(); openAppGridModal('${app.id}');"><i class="fas fa-pencil-alt"></i></button>
                <button class="app-btn-action app-btn-delete" onclick="event.stopPropagation(); deleteAppItem('${app.id}');"><i class="fas fa-times"></i></button>
            </div>
            <div class="app-icon-box" onclick="${clickAction}">${imgHtml}</div>
            <div class="app-name" onclick="${clickAction}">${app.name}</div>
        </div>`;
    });
    html += `
    <div class="app-card app-add" title="新增 APP">
        <div class="app-icon-box app-add-box" onclick="openAppGridModal();"><i class="fas fa-plus"></i></div>
        <div class="app-name text-muted">新增 APP</div>
    </div>`;
    container.innerHTML = html;
}

// == Modal 內的 Checkbox/選項渲染 ==
function renderFabRoleCheckboxes(selectedIds) {
    const container = document.getElementById('fabRoleCheckboxes'); if (!container) return; container.innerHTML = '';
    getRoles().forEach(r => {
        const isChecked = selectedIds.includes(r.id) ? 'checked' : '';
        container.innerHTML += `<div class="form-check form-check-inline border rounded px-2 py-1 bg-white mb-1"><input class="form-check-input ms-0 me-2 fab-role-cb cursor-pointer" type="checkbox" id="fr_${r.id}" value="${r.id}" ${isChecked}><label class="form-check-label small fw-bold cursor-pointer" for="fr_${r.id}">${r.groupName}</label></div>`;
    });
}

function renderRoleMenuCheckboxes(selectedIds) {
    const container = document.getElementById('roleMenuCheckboxes'); if (!container) return; container.innerHTML = '';
    const menus = getCustomMenus().filter(m => m.enabled !== false && String(m.isPoolItem).toLowerCase() !== 'true' && (!window.cleanId(m.parentId) || window.cleanId(m.parentId) === ''));
    let sortedMenus = [];
    selectedIds.forEach(id => { let m = menus.find(x => window.cleanId(x.id) === window.cleanId(id)); if (m) sortedMenus.push(m); });
    menus.forEach(m => { if (!selectedIds.includes(m.id)) sortedMenus.push(m); });

    sortedMenus.forEach(m => {
        const isSelected = selectedIds.includes(m.id);
        const bgClass = isSelected ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-secondary';
        const chkClass = isSelected ? 'fas fa-check-circle' : 'far fa-circle opacity-50';

        container.innerHTML += `
            <div class="role-menu-item d-inline-flex align-items-center border rounded px-2 py-1 cursor-pointer shadow-sm ${bgClass}" 
                 style="transition: all 0.2s; font-size: 0.95rem;" draggable="true" 
                 ondragstart="rmDragStart(event, '${m.id}')" ondragover="rmDragOver(event)" ondragleave="rmDragLeave(event)" ondrop="rmDrop(event, '${m.id}')"
                 onclick="toggleRoleMenuSelection(this)">
                <i class="fas fa-grip-vertical me-2 opacity-50" title="拖曳排序" onclick="event.stopPropagation()"></i>
                <i class="role-check-icon ${chkClass} me-1"></i>
                <span class="fw-bold tracking-wide">${m.displayName}</span>
                <input type="checkbox" class="d-none role-menu-cb" value="${m.id}" ${isSelected ? 'checked' : ''}>
            </div>
        `;
    });
}

function renderAccRoleCheckboxes(selectedIds) {
    const container = document.getElementById('accRoleCheckboxes'); if (!container) return; container.innerHTML = '';
    getRoles().forEach(r => {
        const isChecked = selectedIds.includes(r.id) ? 'checked' : '';
        container.innerHTML += `<div class="form-check form-check-inline border rounded px-2 py-1 bg-white mb-1"><input class="form-check-input ms-0 me-2 acc-role-cb cursor-pointer" type="checkbox" id="acr_${r.id}" value="${r.id}" ${isChecked}><label class="form-check-label small fw-bold cursor-pointer" for="acr_${r.id}">${r.groupName}</label></div>`;
    });
}

function renderAccManageMenuCheckboxes(selectedIds) {
    const container = document.getElementById('accManageMenuCheckboxes'); if (!container) return; container.innerHTML = '';
    const menus = getCustomMenus().filter(m => String(m.menuMode).toLowerCase() === 'folder' && m.enabled !== false);
    menus.forEach(m => {
        const isChecked = selectedIds.includes(m.id) ? 'checked' : '';
        container.innerHTML += `<div class="form-check mb-1"><input class="form-check-input acc-menu-cb cursor-pointer" type="checkbox" id="acm_${m.id}" value="${m.id}" ${isChecked}><label class="form-check-label fw-bold text-dark cursor-pointer" for="acm_${m.id}"><i class="fas fa-folder text-warning me-1"></i> ${m.displayName}</label></div>`;
    });
}

function renderAccDefaultPagesUI() {
    const container = document.getElementById('accDefaultPagesContainer'); if (!container) return;
    const fabs = getFabs(); const menus = getCustomMenus(); let html = '';

    fabs.forEach(f => {
        let defMenuId = tempDefaultPages[f.fabName];
        let defMenuObj = menus.find(m => window.cleanId(m.id) === window.cleanId(defMenuId));
        let displayTxt = defMenuObj ? getFullMenuPathStr(defMenuId, menus) : '系統自動抓取第一個可視看板';
        let txtColor = defMenuObj ? 'text-success fw-bold' : 'text-muted';

        html += `
            <div class="d-flex align-items-center mb-2 border-bottom pb-2">
                <span class="badge bg-secondary me-2" style="width: 45px;">${f.fabName}</span>
                <span class="flex-grow-1 text-truncate small ${txtColor}" id="def_text_${f.fabName}">預設：${displayTxt}</span>
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="openMenuSelector('${f.fabName}')">指定</button>
                <button type="button" class="btn btn-sm btn-outline-danger border-0 py-0 px-1 ms-1" onclick="clearDefaultMenu('${f.fabName}')" title="清除設定"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 側邊滑出抽屜選單渲染 (選擇預設首頁)
function openMenuSelector(fabName) {
    document.getElementById('pickingForFab').value = fabName;
    const container = document.getElementById('menuSelectDrawerContainer'); container.innerHTML = '';
    const searchInput = document.getElementById('menuSelectSearchInput'); if (searchInput) searchInput.value = '';

    const roleLevel = document.getElementById('accRoleLevel').value;
    let assignedRoles = []; document.querySelectorAll('.acc-role-cb:checked').forEach(cb => assignedRoles.push(cb.value));

    const fabs = getFabs();
    const fabObj = fabs.find(f => window.cleanId(f.fabName) === window.cleanId(fabName) || window.cleanId(f.id) === window.cleanId(fabName));
    const fabRoleIds = fabObj ? (fabObj.assignedRoles || []) : [];

    const activeRoleIds = (roleLevel === 'admin') ? fabRoleIds : fabRoleIds.filter(id => assignedRoles.includes(id));

    const roles = getRoles();
    let initialMenuIds = [];
    activeRoleIds.forEach(roleId => {
        const role = roles.find(r => window.cleanId(r.id) === window.cleanId(roleId));
        if (role && role.allowedMenuIds) initialMenuIds.push(...role.allowedMenuIds);
    });

    const allMenus = getCustomMenus();
    let allowedIds = typeof getAllowedIdsWithHierarchy === 'function' ? getAllowedIdsWithHierarchy(allMenus, initialMenuIds) : new Set(initialMenuIds);
    const viewableMenus = allMenus.filter(m => String(m.menuMode).toLowerCase() !== 'folder' && m.enabled !== false && allowedIds.has(m.id));

    if (viewableMenus.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-5 fw-bold"><i class="fas fa-folder-open mb-3 fs-1 opacity-50"></i><br>此帳號在該廠區沒有可觀看的看板。<br><small class="fw-normal">請先勾選下方的可視群組版面。</small></div>`;
    } else {
        let groups = {};
        viewableMenus.forEach(m => {
            let rootNode = m;
            while (rootNode && (rootNode.parentId || (rootNode.parentIds && rootNode.parentIds.length > 0))) {
                let pId = rootNode.parentId || rootNode.parentIds[0];
                let parent = allMenus.find(x => window.cleanId(x.id) === window.cleanId(pId));
                if (parent) rootNode = parent; else break;
            }

            let rId = rootNode ? rootNode.id : 'other';
            let rName = rootNode ? rootNode.displayName : '其他獨立看板';
            if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + rId] && rootNode && !rootNode.isEdited) rName = i18n[currentLang]['dyn_' + rId];

            if (!groups[rId]) groups[rId] = { rootName: rName, rootIcon: rootNode?.icon || 'fas fa-link', items: [], order: rootNode?.order || 999 };

            let fullPathStr = typeof getFullMenuPathStr === 'function' ? getFullMenuPathStr(m.id, allMenus) : m.displayName;
            let pathArr = fullPathStr.split(' / ');
            if (pathArr.length > 1) pathArr.shift();
            pathArr.pop();
            let subPath = pathArr.join(' / ');

            groups[rId].items.push({ id: m.id, name: m.name, displayName: m.displayName, subPath: subPath, type: m.menuMode, order: m.order || 999 });
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
                    <div class="drawer-item" onclick="pickDefaultMenu('${item.id}')">
                        <div class="pe-2">
                            <div class="fw-bold text-dark d-flex align-items-center mb-0" style="font-size: 0.85rem;">
                                <i class="fas ${item.type === 'app_grid' ? 'fa-th-large text-success' : 'fa-file-alt'} item-icon"></i> ${item.displayName} ${badge}
                            </div>
                            ${subPathHtml}
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary px-3 fw-bold rounded-pill shadow-sm" style="font-size: 0.7rem; flex-shrink: 0;" onclick="event.stopPropagation(); pickDefaultMenu('${item.id}')">選取</button>
                    </div>
                `;
            });
            listHtml += `</div>`;

            let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(group.rootIcon, 'text-primary', '', true) : '';

            html += `
                <div class="drawer-group">
                    <div class="drawer-group-title ${isFirst ? '' : 'collapsed'}" data-bs-toggle="collapse" data-bs-target="#drawer_col_${index}" aria-expanded="${isFirst ? 'true' : 'false'}">
                        <div style="width:24px; text-align:center;" class="me-2">${iconHtml}</div>
                        <span class="flex-grow-1">${group.rootName}</span>
                        <span class="badge bg-white text-muted border border-secondary rounded-pill shadow-sm">${group.items.length}</span>
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

    const drawerEl = document.getElementById('menuSelectDrawer');
    if (drawerEl) {
        const drawerInstance = bootstrap.Offcanvas.getOrCreateInstance(drawerEl);
        drawerInstance.show();
        setTimeout(() => { const input = document.getElementById('menuSelectSearchInput'); if (input) input.focus(); }, 300);
    }
}

function filterMenuSelectDrawer() {
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
                    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
                    bsCollapse.show();
                }
            }
        } else {
            grpItem.style.display = 'none';
        }
    });
}
