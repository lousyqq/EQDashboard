// ====== 後台管理 CRUD 與 Drag & Drop 拖曳邏輯 ======

// ⭐️ 終極物理開窗模式：徹底繞過 Visual Studio Browser Link 的底層干擾
function showModalSafely(modalId) {
    const el = document.getElementById(modalId);
    if (!el) {
        console.error("🚨 系統錯誤：找不到彈窗元素 [" + modalId + "]");
        return;
    }

    try {
        // 先嘗試標準的 Bootstrap 開窗
        if (typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(el).show();
            return; // 成功就結束
        }
    } catch (error) {
        // ⭐️ 靜默處理 Visual Studio BrowserLink 衝突，移除 console.warn，讓右側視窗不再報錯
    }

    // --- 以下為【物理強制開窗模式】(當 Bootstrap 被干擾時的無敵備案) ---
    el.classList.add('show');
    el.style.display = 'block';
    el.removeAttribute('aria-hidden');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('role', 'dialog');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // 建立背景黑罩
    if (!document.querySelector('.modal-backdrop.force-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show force-backdrop';
        document.body.appendChild(backdrop);
    }

    // 為視窗內的關閉按鈕，強加物理關窗事件
    const closeBtns = el.querySelectorAll('[data-bs-dismiss="modal"]');
    closeBtns.forEach(btn => {
        btn.onclick = function (e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            e.stopPropagation();
            hideModalSafely(modalId);
        };
    });
}

function hideModalSafely(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;

    // --- 1. 物理強制關閉 (無差別執行，保證畫面絕對乾淨，無懼任何套件或 BrowserLink 衝突) ---
    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('aria-modal');
    el.removeAttribute('role');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';

    // 2. 暴力清除所有卡住的背景黑罩
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

    // 3. 為了維持 Bootstrap 內部狀態機正常，溫和地呼叫 hide() (不依賴它改變畫面，且移除 return 阻斷)
    try {
        if (typeof bootstrap !== 'undefined') {
            const inst = bootstrap.Modal.getInstance(el) || bootstrap.Modal.getOrCreateInstance(el);
            if (inst) inst.hide();
        }
    } catch (error) {
        // 靜默處理
    }
}

// === 權限檢查輔助 ===
function canManageFolderStructure(folderId) {
    if (!currentUser) return false;
    if (currentUser.roleLevel === 'admin') return true;
    if (!folderId) return true;

    const menus = getCustomMenus();
    const fNode = menus.find(m => window.cleanId(m.id) === window.cleanId(folderId));
    if (!fNode) return true;

    if (window.cleanId(fNode.createdBy) === window.cleanId(currentUser.id)) return true;
    if (currentUser.manageableMenus && currentUser.manageableMenus.some(m => window.cleanId(m) === window.cleanId(folderId))) return true;

    let isUnderDelegated = false;
    let queue = [window.cleanId(folderId)];
    let visited = new Set();
    while (queue.length > 0) {
        let curr = queue.shift();
        if (currentUser.manageableMenus && currentUser.manageableMenus.some(m => window.cleanId(m) === curr)) { isUnderDelegated = true; break; }
        visited.add(curr);
        let m = menus.find(x => window.cleanId(x.id) === curr);
        if (m) {
            let pId = window.cleanId(m.parentId);
            if (pId && pId !== 'null' && !visited.has(pId)) queue.push(pId);
            if (m.parentIds) m.parentIds.forEach(p => {
                let cPid = window.cleanId(p);
                if (cPid && cPid !== 'null' && !visited.has(cPid)) queue.push(cPid);
            });
        }
    }
    return isUnderDelegated;
}

// === Fabs 廠區管理 ===
function openAddFabModal() {
    try {
        document.getElementById('fabForm').reset();
        document.getElementById('editFabId').value = '';
        document.getElementById('fabNameInput').disabled = false;
        if (typeof renderFabRoleCheckboxes === 'function') renderFabRoleCheckboxes([]);
        showModalSafely('fabModal');
    } catch (e) { console.error("[openAddFabModal] 錯誤:", e); }
}

function editFab(id) {
    try {
        const fab = getFabs().find(f => window.cleanId(f.id) === window.cleanId(id));
        if (!fab) { console.error("找不到對應的廠區資料 (ID: " + id + ")"); return; }

        document.getElementById('editFabId').value = fab.id;
        document.getElementById('fabNameInput').value = fab.fabName;
        document.getElementById('fabNameInput').disabled = true;
        document.getElementById('fabDisplayNameInput').value = fab.displayName || '';
        document.getElementById('fabLangSelect').value = fab.defaultLang || 'zh';
        if (typeof renderFabRoleCheckboxes === 'function') renderFabRoleCheckboxes(fab.assignedRoles || []);
        showModalSafely('fabModal');
    } catch (e) { console.error("[editFab] 錯誤:", e); }
}

function saveFabItem(e) {
    // ⭐️ 核心防重整：移到 try 外面，保證 100% 阻擋網頁跳轉
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('editFabId').value;
        const fabName = document.getElementById('fabNameInput').value.trim();
        const displayName = document.getElementById('fabDisplayNameInput').value.trim();
        const lang = document.getElementById('fabLangSelect').value;

        let assignedRoles = [];
        document.querySelectorAll('.fab-role-cb:checked').forEach(cb => assignedRoles.push(cb.value));

        let fabs = getFabs();
        if (id) {
            let f = fabs.find(x => window.cleanId(x.id) === window.cleanId(id));
            if (f) { f.displayName = displayName; f.defaultLang = lang; f.assignedRoles = assignedRoles; }
        } else {
            if (fabs.some(f => window.cleanId(f.fabName) === window.cleanId(fabName))) { customAlert('廠區ID已存在！'); return false; }
            fabs.push({ id: 'fab_' + Date.now(), fabName: fabName, displayName: displayName || fabName, defaultLang: lang, assignedRoles: assignedRoles });
        }

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('fabModal');
        if (typeof renderFabTable === 'function') renderFabTable();
        if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
    } catch (error) { console.error("[saveFabItem] 錯誤:", error); }
    return false;
}

function deleteFab(id) {
    try {
        customConfirm('確定要刪除此廠區嗎？', () => {
            let fabs = getFabs().filter(f => window.cleanId(f.id) !== window.cleanId(id));
            window.appState.fabs = fabs;

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderFabTable === 'function') renderFabTable();
            if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
        });
    } catch (e) { console.error("[deleteFab] 錯誤:", e); }
}

// === Roles 群組管理 ===
function openAddRoleModal() {
    try {
        document.getElementById('roleForm').reset();
        document.getElementById('editRoleId').value = '';
        if (typeof renderRoleMenuCheckboxes === 'function') renderRoleMenuCheckboxes([]);
        showModalSafely('roleModal');
    } catch (e) { console.error("[openAddRoleModal] 錯誤:", e); }
}

function editRole(id) {
    try {
        const role = getRoles().find(r => window.cleanId(r.id) === window.cleanId(id));
        if (!role) { console.error("找不到對應的群組資料 (ID: " + id + ")"); return; }

        document.getElementById('editRoleId').value = role.id;
        document.getElementById('roleName').value = role.groupName;
        if (typeof renderRoleMenuCheckboxes === 'function') renderRoleMenuCheckboxes(role.allowedMenuIds || []);
        showModalSafely('roleModal');
    } catch (e) { console.error("[editRole] 錯誤:", e); }
}

function toggleRoleMenuSelection(el) {
    const cb = el.querySelector('.role-menu-cb');
    cb.checked = !cb.checked;
    const icon = el.querySelector('.role-check-icon');

    if (cb.checked) {
        el.classList.remove('bg-white', 'text-secondary', 'border-secondary');
        el.classList.add('bg-primary', 'text-white', 'border-primary');
        if (icon) {
            icon.classList.remove('far', 'fa-circle', 'opacity-50');
            icon.classList.add('fas', 'fa-check-circle');
        }
    } else {
        el.classList.remove('bg-primary', 'text-white', 'border-primary');
        el.classList.add('bg-white', 'text-secondary', 'border-secondary');
        if (icon) {
            icon.classList.remove('fas', 'fa-check-circle');
            icon.classList.add('far', 'fa-circle', 'opacity-50');
        }
    }
}

// ⭐️ 核心修復：補回遺失的群組看板渲染邏輯與拖曳排序功能
let rmDragSrcId = null;
let rmDragSrcEl = null;

window.renderRoleMenuCheckboxes = function (selectedIds) {
    if (!selectedIds || !Array.isArray(selectedIds)) selectedIds = [];
    const container = document.getElementById('roleMenuCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    // 過濾出可供綁定的主選單 (排除已被停用、或是歸類為池中項目的選單)
    const menus = getCustomMenus().filter(m =>
        (m.enabled !== false && m.IsEnabled !== false) &&
        String(m.isPoolItem || m.IsPoolItem).toLowerCase() !== 'true' &&
        (!window.cleanId(m.parentId || m.ParentMenuId) || window.cleanId(m.parentId || m.ParentMenuId) === '')
    );

    let sortedMenus = [];
    // 1. 已被勾選的按照排序放在最前面
    selectedIds.forEach(id => {
        let m = menus.find(x => window.cleanId(x.id || x.MenuId) === window.cleanId(id));
        if (m) sortedMenus.push(m);
    });
    // 2. 未被勾選的接在後面
    menus.forEach(m => {
        if (!selectedIds.includes(window.cleanId(m.id || m.MenuId))) sortedMenus.push(m);
    });

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
                 onclick="toggleRoleMenuSelection(this)">
                <i class="fas fa-grip-vertical me-2 opacity-50" title="拖曳排序" onclick="event.stopPropagation()"></i>
                <i class="role-check-icon ${chkClass} me-1"></i>
                <span class="fw-bold tracking-wide">${mDName}</span>
                <input type="checkbox" class="d-none role-menu-cb" value="${mId}" ${isSelected ? 'checked' : ''}>
            </div>
        `;
    });
};

window.rmDragStart = function (e, id) {
    rmDragSrcId = id;
    rmDragSrcEl = e.target.closest('.role-menu-item');
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (rmDragSrcEl) rmDragSrcEl.classList.add('dragging'); }, 0);
};
window.rmDragOver = function (e) {
    e.preventDefault();
    const item = e.target.closest('.role-menu-item');
    if (item && item !== rmDragSrcEl) item.style.borderLeft = '4px solid #dc3545';
};
window.rmDragLeave = function (e) {
    const item = e.target.closest('.role-menu-item');
    if (item) item.style.borderLeft = '';
};
window.rmDrop = function (e, targetId) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.role-menu-item').forEach(el => { el.classList.remove('dragging'); el.style.borderLeft = ''; });
    if (!rmDragSrcId || rmDragSrcId === targetId) return;

    const container = document.getElementById('roleMenuCheckboxes');
    const items = Array.from(container.children);
    const srcEl = items.find(el => window.cleanId(el.querySelector('.role-menu-cb').value) === window.cleanId(rmDragSrcId));
    const targetEl = items.find(el => window.cleanId(el.querySelector('.role-menu-cb').value) === window.cleanId(targetId));

    if (srcEl && targetEl) {
        const srcIdx = items.indexOf(srcEl);
        const tgtIdx = items.indexOf(targetEl);
        if (srcIdx < tgtIdx) targetEl.after(srcEl);
        else targetEl.before(srcEl);
    }
    rmDragSrcId = null;
};

function saveRoleItem(e) {
    // ⭐️ 核心防重整：移到 try 外面，保證 100% 阻擋網頁跳轉
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('editRoleId').value;
        const name = document.getElementById('roleName').value.trim();

        let allowed = [];
        document.querySelectorAll('.role-menu-item').forEach(el => {
            const cb = el.querySelector('.role-menu-cb');
            if (cb && cb.checked) allowed.push(cb.value);
        });

        let roles = getRoles();
        if (id) {
            let r = roles.find(x => window.cleanId(x.id) === window.cleanId(id));
            if (r) { r.groupName = name; r.allowedMenuIds = allowed; }
        } else {
            roles.push({ id: 'role_' + Date.now(), groupName: name, allowedMenuIds: allowed });
        }

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('roleModal');
        if (typeof renderRoleTable === 'function') renderRoleTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (error) { console.error("[saveRoleItem] 錯誤:", error); }
    return false;
}

function deleteRole(id) {
    try {
        customConfirm('確定要刪除此群組嗎？(若有廠區或帳號綁定此群組將自動解除)', () => {
            let roles = getRoles().filter(r => window.cleanId(r.id) !== window.cleanId(id));
            window.appState.roles = roles;

            let fabs = getFabs();
            fabs.forEach(f => { if (f.assignedRoles) f.assignedRoles = f.assignedRoles.filter(r => window.cleanId(r) !== window.cleanId(id)); });

            let accs = getAccounts();
            accs.forEach(a => { if (a.assignedRoles) a.assignedRoles = a.assignedRoles.filter(r => window.cleanId(r) !== window.cleanId(id)); });

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderRoleTable === 'function') renderRoleTable();
            if (typeof renderFabTable === 'function') renderFabTable();
            if (typeof renderAccountTable === 'function') renderAccountTable();
        });
    } catch (e) { console.error("[deleteRole] 錯誤:", e); }
}

// === Accounts 帳號管理 ===
function openAddAccountModal() {
    try {
        document.getElementById('accForm').reset();
        document.getElementById('editAccMode').value = '';

        // ⭐️ 修復 1：工號欄位狀態還原，確保新增時可輸入 (解除 readOnly 與 disabled)
        document.getElementById('accEmpId').readOnly = false;
        document.getElementById('accEmpId').disabled = false;

        document.getElementById('accRoleLevel').value = 'user';
        document.getElementById('accRoleLevel').disabled = false;
        document.getElementById('accEnableDelegation').checked = false;

        // ⭐️ 修復 2：移除這行舊版的 HTML 覆寫，它會因為找不到舊容器而導致程式報錯中斷！
        // document.getElementById('accRoleCheckboxesContainer').innerHTML = '<div id="accRoleCheckboxes" class="d-flex flex-wrap gap-1 mt-1"></div>';

        tempDefaultPages = {};

        // ⭐️ 修復 3：重置時連同委派細節區塊一併還原/收起
        if (typeof toggleAccDelegationUI === 'function') toggleAccDelegationUI();
        if (typeof toggleDelegationDetails === 'function') toggleDelegationDetails();

        if (typeof renderAccRoleCheckboxes === 'function') renderAccRoleCheckboxes([]);
        if (typeof renderAccManageMenuCheckboxes === 'function') renderAccManageMenuCheckboxes([]);
        if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();

        showModalSafely('accModal');
    } catch (e) { console.error("[openAddAccountModal] 錯誤:", e); }
}

function editAccount(empId) {
    try {
        const acc = getAccounts().find(a => window.cleanId(a.empId) === window.cleanId(empId));
        if (!acc) { console.error("找不到對應的帳號資料 (工號: " + empId + ")"); return; }

        document.getElementById('editAccMode').value = 'edit';
        document.getElementById('accEmpId').value = acc.empId; document.getElementById('accEmpId').disabled = true;
        document.getElementById('accName').value = acc.name || ''; document.getElementById('accDept').value = acc.department || '';
        document.getElementById('accRoleLevel').value = acc.roleLevel || 'user';
        // 編輯系統預設 admin 時不允許降級
        const isSystemAdmin = window.cleanId(acc.empId) === 'admin';
        document.getElementById('accRoleLevel').disabled = isSystemAdmin;
        document.getElementById('accEnableDelegation').checked = (acc.manageableMenus && acc.manageableMenus.length > 0);
        document.getElementById('accCanEditOthers').checked = acc.canEditOthers || false;

        tempDefaultPages = JSON.parse(JSON.stringify(acc.defaultPages || {}));
        if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();
        if (typeof renderAccRoleCheckboxes === 'function') renderAccRoleCheckboxes(acc.assignedRoles || []);
        if (typeof renderAccManageMenuCheckboxes === 'function') renderAccManageMenuCheckboxes(acc.manageableMenus || []);
        toggleAccDelegationUI(); toggleDelegationDetails();

        showModalSafely('accModal');
    } catch (e) { console.error("[editAccount] 錯誤:", e); }
}

function saveAccountItem(e) {
    // ⭐️ 核心防重整：移到 try 外面，保證 100% 阻擋網頁跳轉
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const mode = document.getElementById('editAccMode').value; const empId = document.getElementById('accEmpId').value.trim();
        const name = document.getElementById('accName').value.trim(); const dept = document.getElementById('accDept').value.trim();
        const lvl = document.getElementById('accRoleLevel').value;

        let assigned = []; document.querySelectorAll('.acc-role-cb:checked').forEach(cb => assigned.push(cb.value));
        let manageable = []; let canEditOthers = false;
        if (lvl === 'user' && document.getElementById('accEnableDelegation').checked) {
            document.querySelectorAll('.acc-menu-cb:checked').forEach(cb => manageable.push(cb.value));
            canEditOthers = document.getElementById('accCanEditOthers').checked;
        }

        let accs = getAccounts();
        if (mode === 'edit') {
            let a = accs.find(x => window.cleanId(x.empId) === window.cleanId(empId));
            if (a) {
                a.name = name; a.department = dept; a.roleLevel = lvl;
                a.assignedRoles = assigned; a.manageableMenus = manageable;
                a.canEditOthers = canEditOthers; a.defaultPages = JSON.parse(JSON.stringify(tempDefaultPages));
            }
        } else {
            if (accs.some(a => window.cleanId(a.empId) === window.cleanId(empId))) { customAlert('工號已存在！'); return false; }

            accs.push({
                empId: empId, name: name, department: dept, roleLevel: lvl,
                assignedRoles: assigned, manageableMenus: manageable,
                canEditOthers: canEditOthers, defaultPages: JSON.parse(JSON.stringify(tempDefaultPages))
            });
        }

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('accModal');
        if (typeof renderAccountTable === 'function') renderAccountTable();

        if (currentUser && window.cleanId(currentUser.id) === window.cleanId(empId)) {
            currentUser.name = name; currentUser.department = dept; currentUser.roleLevel = lvl;
            currentUser.assignedRoles = assigned; currentUser.manageableMenus = manageable;
            currentUser.canEditOthers = canEditOthers; currentUser.defaultPages = JSON.parse(JSON.stringify(tempDefaultPages));
            localStorage.setItem('umc_current_user', JSON.stringify(currentUser));

            // 修改到自己的可視群組版面時，立即刷新右上角廠區下拉與側邊欄
            if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
            if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        }
    } catch (error) { console.error("[saveAccountItem] 錯誤:", error); }
    return false;
}

function deleteAccount(empId) {
    try {
        if (window.cleanId(empId) === 'admin') { customAlert('系統預設管理員無法刪除！'); return; }
        customConfirm('確定要刪除此帳號嗎？', () => {
            let accs = getAccounts().filter(a => window.cleanId(a.empId) !== window.cleanId(empId));
            window.appState.accounts = accs;

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderAccountTable === 'function') renderAccountTable();
        });
    } catch (e) { console.error("[deleteAccount] 錯誤:", e); }
}

function pickDefaultMenu(menuId) {
    const fab = document.getElementById('pickingForFab').value;
    tempDefaultPages[fab] = menuId;
    if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();
    const drawerEl = document.getElementById('menuSelectDrawer');
    if (drawerEl) {
        const instance = bootstrap.Offcanvas.getInstance(drawerEl) || bootstrap.Offcanvas.getOrCreateInstance(drawerEl);
        if (instance) instance.hide();
    }
}

function clearDefaultMenu(fabName) {
    delete tempDefaultPages[fabName];
    if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();
}

function toggleAccDelegationUI() {
    const lvl = document.getElementById('accRoleLevel').value;
    const grp = document.getElementById('accDelegationGroup');
    if (grp) grp.style.display = lvl === 'user' ? 'block' : 'none';
}

function toggleDelegationDetails() {
    const checked = document.getElementById('accEnableDelegation').checked;
    const det = document.getElementById('accDelegationDetails');
    if (det) det.style.display = checked ? 'block' : 'none';
}

// === Personal Menus 個人選單（對齊 TEST_20260429.html:3744-3771）===
function togglePerMenuExpand(id) {
    if (expandedPerMenuIds.has(id)) expandedPerMenuIds.delete(id);
    else expandedPerMenuIds.add(id);
    isPerAllExpanded = false;
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
}

function togglePerAllMenus() {
    const menusData = getCustomMenus().filter(m =>
        String(m.isPoolItem || m.IsPoolItem).toLowerCase() !== 'true'
    );
    const menusWithChildren = menusData.filter(m =>
        menusData.some(child => child.parentId === m.id || (child.parentIds && child.parentIds.includes(m.id)))
    );

    const btn = document.getElementById('btn-per-toggle-all');
    if (isPerAllExpanded) {
        expandedPerMenuIds.clear();
        isPerAllExpanded = false;
        if (btn) btn.innerHTML = '<i class="fas fa-expand-arrows-alt me-1"></i> 全部展開';
    } else {
        menusWithChildren.forEach(m => expandedPerMenuIds.add(m.id));
        isPerAllExpanded = true;
        if (btn) btn.innerHTML = '<i class="fas fa-compress-arrows-alt me-1"></i> 全部收合';
    }
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
}

function restoreDefaultPersonalMenu() {
    customConfirm('確定要還原成預設系統版面嗎？您所有的個人自訂排序與隱藏設定將會被清除。', () => {
        localStorage.removeItem('umc_personal_menus_' + currentUser.id);
        if (typeof syncDataToDB === 'function') syncDataToDB();
        if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        if (typeof customAlert === 'function') customAlert('已成功還原為預設版面！');
    });
}

function editPersonalMenu(id) {
    try {
        const menu = getCustomMenus().find(m => window.cleanId(m.id) === window.cleanId(id));
        if (!menu) { console.error("找不到對應的選單資料 (ID: " + id + ")"); return; }

        const pSets = getPersonalSettings(currentUser.id);
        const pSet = pSets[id] || {};

        document.getElementById('editPersonalMenuId').value = menu.id;
        document.getElementById('personalMenuName').value = menu.displayName;
        document.getElementById('personalMenuVisible').checked = !(pSet.hidden === true);
        setIconValToModal('personalMenu', pSet.icon || '');

        const targetGrp = document.getElementById('personalTargetGroup');
        if (menu.menuMode === 'folder') targetGrp.style.display = 'none';
        else {
            targetGrp.style.display = 'block';
            document.getElementById('personalMenuTarget').value = pSet.target || '';
        }
        showModalSafely('personalMenuModal');
    } catch (e) { console.error("[editPersonalMenu] 錯誤:", e); }
}

function savePersonalMenu(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('editPersonalMenuId').value;
        let pSets = getPersonalSettings(currentUser.id);
        if (!pSets[id]) pSets[id] = {};

        pSets[id].hidden = !document.getElementById('personalMenuVisible').checked;
        pSets[id].icon = getSelectedIconVal('personalMenu');

        const target = document.getElementById('personalMenuTarget').value;
        if (target) pSets[id].target = target; else delete pSets[id].target;

        savePersonalSettings(currentUser.id, pSets);

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('personalMenuModal');
        if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (error) { console.error("[savePersonalMenu] 錯誤:", error); }
    return false;
}

// === Webpages 看板管理 ===
function toggleWebpageMode() {
    const isAppGrid = document.getElementById('wpModeAppGrid').checked;
    const urlGrp = document.getElementById('wpUrlGroup');
    const targetGrp = document.getElementById('wpTargetGroup');
    if (isAppGrid) {
        urlGrp.style.display = 'none'; targetGrp.style.display = 'none';
        document.getElementById('wpTarget').value = 'iframe';
        document.getElementById('wpUrl').value = 'page-app-grid';
    } else {
        urlGrp.style.display = 'block'; targetGrp.style.display = 'block';
    }
}

function openAddWebpageModal(id = null) {
    try {
        document.getElementById('wpForm').reset();
        document.getElementById('editWpId').value = id || '';
        document.getElementById('wpModeLink').checked = true;
        toggleWebpageMode();
        setIconValToModal('wp', '');

        if (id) {
            const m = getCustomMenus().find(x => window.cleanId(x.id) === window.cleanId(id));
            if (m) {
                if (m.menuMode === 'app_grid') document.getElementById('wpModeAppGrid').checked = true;
                else document.getElementById('wpModeLink').checked = true;
                toggleWebpageMode();

                document.getElementById('wpSysName').value = m.name;
                document.getElementById('wpDisplayName').value = m.displayName;
                document.getElementById('wpUrl').value = m.url || m.targetPage || '';
                document.getElementById('wpTarget').value = m.target || 'iframe';
                setIconValToModal('wp', m.icon || '');
            }
        }
        showModalSafely('webpageModal');
    } catch (e) { console.error("[openAddWebpageModal] 錯誤:", e); }
}

function saveWebpageItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('editWpId').value;
        const isAppGrid = document.getElementById('wpModeAppGrid').checked;
        let menus = getCustomMenus();

        // 對齊 TEST_20260429.html:3897 — 新建的看板網頁預設為池中項目 (isPoolItem: true)
        let mObj;
        if (id) {
            mObj = menus.find(x => window.cleanId(x.id) === window.cleanId(id));
        } else {
            mObj = {
                id: 'm_' + Date.now(),
                isPoolItem: true,
                createdBy: currentUser.id,
                parentId: null,
                parentIds: [],
                parentOrders: {}
            };
        }

        mObj.name = document.getElementById('wpSysName').value.trim();
        mObj.displayName = document.getElementById('wpDisplayName').value.trim();
        mObj.menuMode = isAppGrid ? 'app_grid' : 'link';
        mObj.icon = getSelectedIconVal('wp');
        mObj.enabled = true;
        mObj.isEdited = true;
        // 編輯既有的池中項目時也維持 isPoolItem=true
        if (id) mObj.isPoolItem = true;

        if (isAppGrid) {
            mObj.targetPage = 'page-app-grid'; mObj.url = ''; mObj.target = 'iframe';
        } else {
            let inputUrl = document.getElementById('wpUrl').value.trim();
            if (inputUrl.startsWith('page-')) { mObj.targetPage = inputUrl; mObj.url = ''; }
            else { mObj.url = inputUrl; mObj.targetPage = 'page-iframe'; }
            mObj.target = document.getElementById('wpTarget').value;
        }

        if (!id) {
            mObj.order = menus.length * 10;
            menus.push(mObj);
            window.appState.menus = menus;
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('webpageModal');

        if (typeof renderWebpageTable === 'function') renderWebpageTable();
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (error) { console.error("[saveWebpageItem] 錯誤:", error); }
    return false;
}

function deleteWebpageItem(id) {
    try {
        customConfirm('確定要刪除此看板嗎？', () => {
            let menus = getCustomMenus().filter(m => window.cleanId(m.id) !== window.cleanId(id));
            window.appState.menus = menus;

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderWebpageTable === 'function') renderWebpageTable();
            if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
            if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        });
    } catch (e) { console.error("[deleteWebpageItem] 錯誤:", e); }
}

// === Menus 結構管理 (巢狀樹狀編輯器) ===
function toggleNodeMode() {
    const isFolder = document.getElementById('nodeModeFolder').checked;
    document.getElementById('nodeUrlGroup').style.display = isFolder ? 'none' : 'block';
    document.getElementById('nodeTargetGroup').style.display = isFolder ? 'none' : 'block';
    document.getElementById('treeBuilderSection').style.display = isFolder ? 'block' : 'none';
}

function getLinkOptionsHtml(selectedId) {
    let menus = getCustomMenus().filter(m => m.menuMode !== 'folder');
    let html = '<option value="">請選擇看板...</option>';
    menus.forEach(m => {
        let sel = window.cleanId(m.id) === window.cleanId(selectedId) ? 'selected' : '';
        html += `<option value="${m.id}" ${sel}>${m.displayName} (${m.name})</option>`;
    });
    return html;
}

window.tbAddLink = function (container, menuId = null) {
    let div = document.createElement('div');
    div.className = 'd-flex align-items-center mb-2 bg-white border rounded p-2 shadow-sm tb-item tb-link';
    div.setAttribute('data-type', 'link');
    div.setAttribute('draggable', 'true');
    div.innerHTML = `
        <i class="fas fa-grip-vertical text-muted me-3 cursor-move tb-drag-handle" style="cursor: grab;"></i>
        <i class="fas fa-link text-primary me-2"></i>
        <select class="form-select form-select-sm flex-grow-1 border-primary bg-primary bg-opacity-10 text-primary fw-bold tb-link-select">
            ${getLinkOptionsHtml(menuId)}
        </select>
        <button type="button" class="btn btn-sm text-danger border-0 ms-2" onclick="this.closest('.tb-item').remove()"><i class="fas fa-times"></i></button>
    `;
    if (container) container.appendChild(div);
    return div;
};

window.tbAddFolder = function (container, folderName = '', folderId = '') {
    let div = document.createElement('div');
    div.className = 'mb-2 bg-white border border-warning rounded p-2 shadow-sm tb-item tb-folder';
    div.setAttribute('data-type', 'folder');
    div.setAttribute('data-id', folderId);
    div.setAttribute('draggable', 'true');
    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <i class="fas fa-grip-vertical text-muted me-3 cursor-move tb-drag-handle" style="cursor: grab;"></i>
            <i class="fas fa-folder text-warning me-2 fs-5"></i>
            <input type="text" class="form-control form-control-sm flex-grow-1 border-warning fw-bold text-dark tb-folder-name" value="${folderName}" placeholder="群組名稱">
            <button type="button" class="btn btn-sm btn-outline-danger border-0 ms-2" onclick="this.closest('.tb-item').remove()"><i class="fas fa-trash-alt me-1"></i>移除群組</button>
        </div>
        <div class="tb-children ps-4 ms-2 border-start border-warning border-2 pb-1 pt-1" style="min-height: 30px;"></div>
        <div class="ps-4 ms-2 mt-1">
            <button type="button" class="btn btn-sm btn-link text-decoration-none fw-bold p-0" onclick="window.tbAddLink(this.closest('.tb-folder').querySelector('.tb-children'))"><i class="fas fa-plus me-1"></i>加入看板</button>
        </div>
    `;
    if (container) container.appendChild(div);
    return div;
};

function buildTreeUI(container, parentId) {
    let menus = getCustomMenus();
    let children = menus.filter(m => m.id !== parentId && (window.isParentMatch(m.parentId, { id: parentId }) || (m.parentIds || []).some(pid => window.isParentMatch(pid, { id: parentId }))));
    children.sort((a, b) => (a.parentOrders?.[parentId] ?? a.order ?? 0) - (b.parentOrders?.[parentId] ?? b.order ?? 0));

    children.forEach(c => {
        if (c.menuMode === 'folder') {
            let folderDiv = window.tbAddFolder(container, c.displayName, c.id);
            buildTreeUI(folderDiv.querySelector('.tb-children'), c.id);
        } else {
            window.tbAddLink(container, c.id);
        }
    });
}

function initTreeDragAndDrop() {
    const section = document.getElementById('treeBuilderSection');
    if (!section || section._dndInit) return;
    section._dndInit = true;
    let dragged = null;

    section.addEventListener('dragstart', function (e) {
        if (e.target.classList && e.target.classList.contains('tb-item')) {
            dragged = e.target;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', dragged.innerHTML);
            setTimeout(() => dragged.classList.add('opacity-50'), 0);
        }
    });
    section.addEventListener('dragover', function (e) {
        e.preventDefault();
        const target = e.target.closest('.tb-item');
        if (target && target !== dragged && !dragged.contains(target)) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            target.parentNode.insertBefore(dragged, next && target.nextSibling || target);
        } else if (e.target.classList.contains('tb-children') || e.target.id === 'treeBuilderContainer') {
            if (e.target.children.length === 0 && !dragged.contains(e.target)) {
                e.target.appendChild(dragged);
            }
        }
    });
    section.addEventListener('dragend', function (e) {
        if (dragged) dragged.classList.remove('opacity-50');
        dragged = null;
    });
}

function parseTreeDOM(container, parentId) {
    let items = container.children;
    let order = 0;
    let results = [];
    for (let i = 0; i < items.length; i++) {
        let el = items[i];
        if (!el.classList.contains('tb-item')) continue;

        let type = el.getAttribute('data-type');
        if (type === 'link') {
            let sel = el.querySelector('.tb-link-select');
            if (sel && sel.value) {
                results.push({ id: sel.value, type: 'link', parentId: parentId, order: order });
                order += 10;
            }
        } else if (type === 'folder') {
            let nameInput = el.querySelector('.tb-folder-name');
            let folderId = el.getAttribute('data-id');
            let folderName = nameInput ? nameInput.value.trim() : '未命名群組';

            if (!folderId || folderId.startsWith('temp_') || folderId === '') {
                folderId = 'f_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                el.setAttribute('data-id', folderId);
            }

            results.push({ id: folderId, type: 'folder', name: folderName, parentId: parentId, order: order });
            order += 10;

            let childrenContainer = el.querySelector('.tb-children');
            if (childrenContainer) {
                let childResults = parseTreeDOM(childrenContainer, folderId);
                results = results.concat(childResults);
            }
        }
    }
    return results;
}

function openAddMenuNodeModal(id = null) {
    try {
        document.getElementById('nodeForm').reset();
        document.getElementById('editNodeId').value = id || '';
        document.getElementById('nodeModeFolder').checked = true;
        toggleNodeMode();
        setIconValToModal('node', '');

        const container = document.getElementById('treeBuilderContainer');
        container.innerHTML = '';

        const menus = getCustomMenus();
        if (id) {
            const m = menus.find(x => window.cleanId(x.id) === window.cleanId(id));
            if (m) {
                if (m.menuMode !== 'folder') document.getElementById('nodeModeLink').checked = true;
                toggleNodeMode();

                document.getElementById('nodeName').value = m.name;
                document.getElementById('nodeDisplayName').value = m.displayName;
                document.getElementById('nodeUrl').value = m.url || m.targetPage || '';
                document.getElementById('nodeTarget').value = m.target || 'iframe';
                setIconValToModal('node', m.icon || '');

                if (m.menuMode === 'folder') {
                    buildTreeUI(container, m.id);
                }
            }
        }

        setTimeout(() => initTreeDragAndDrop(), 100);
        showModalSafely('menuNodeModal');
    } catch (e) { console.error("[openAddMenuNodeModal] 錯誤:", e); }
}

function saveMenuNodeItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('editNodeId').value;
        const isFolder = document.getElementById('nodeModeFolder').checked;
        let menus = getCustomMenus();

        let mObj = id ? menus.find(x => window.cleanId(x.id) === window.cleanId(id)) : { id: 'm_' + Date.now(), isPoolItem: false, createdBy: currentUser.id, parentId: null, parentIds: [] };

        mObj.name = document.getElementById('nodeName').value.trim();
        mObj.displayName = document.getElementById('nodeDisplayName').value.trim();
        mObj.menuMode = isFolder ? 'folder' : 'link';
        mObj.icon = getSelectedIconVal('node');
        mObj.isEdited = true;

        if (!id) {
            mObj.enabled = true; // 新節點預設啟用
            mObj.order = menus.length * 10;
            menus.push(mObj);
        }

        // ⭐️ 阻斷無窮迴圈的舊有子孫比對器
        let oldDescendants = [];
        let visitedDesc = new Set();
        function getOldDesc(pId) {
            if (visitedDesc.has(pId)) return;
            visitedDesc.add(pId);
            menus.filter(m => m.menuMode === 'folder' && m.id !== pId && (window.isParentMatch(m.parentId, { id: pId }) || (m.parentIds || []).some(x => window.isParentMatch(x, { id: pId }))))
                .forEach(m => { oldDescendants.push(m.id); getOldDesc(m.id); });
        }
        if (mObj.id) getOldDesc(mObj.id);

        if (!isFolder) {
            let inputUrl = document.getElementById('nodeUrl').value.trim();
            if (inputUrl.startsWith('page-')) { mObj.targetPage = inputUrl; mObj.url = ''; }
            else { mObj.url = inputUrl; mObj.targetPage = 'page-iframe'; }
            mObj.target = document.getElementById('nodeTarget').value;

            // 對齊 TEST_20260429.html:4302 — 只清除「以 mObj.id 為父的子節點」的 parent 關聯，
            // 不去動其他人的 isPoolItem 旗標（避免把根層的 link/folder 誤標成池中項目）
            const myId = window.cleanId(mObj.id);
            menus.forEach(m => {
                if (window.cleanId(m.id) === myId) return; // 跳過自己
                if (window.cleanId(m.parentId) === myId) m.parentId = null;
                if (m.parentIds) m.parentIds = m.parentIds.filter(pid => window.cleanId(pid) !== myId);
                if (m.parentOrders) delete m.parentOrders[mObj.id];
            });
            // 從群組改為連結時，連同它原有的子群組也一起拿掉
            menus = menus.filter(m => !oldDescendants.includes(m.id));
        } else {
            mObj.url = ''; mObj.targetPage = '';
            let treeNodes = parseTreeDOM(document.getElementById('treeBuilderContainer'), mObj.id);

            let treeIds = treeNodes.map(t => t.id);
            let foldersToDelete = oldDescendants.filter(fid => !treeIds.includes(fid));
            menus = menus.filter(m => !foldersToDelete.includes(m.id));

            // 對齊 TEST_20260429.html:4302 — 只清除「以 mObj.id 或舊子群組為父」的關聯，
            // 不主動把其他人標為池中項目（mObj 本身是 root folder，會被誤標而消失）
            const myIds = new Set([window.cleanId(mObj.id), ...oldDescendants.map(window.cleanId)]);
            menus.forEach(m => {
                if (myIds.has(window.cleanId(m.id))) return; // 跳過自己與舊子群組
                if (myIds.has(window.cleanId(m.parentId))) m.parentId = null;
                if (m.parentIds) m.parentIds = m.parentIds.filter(pid => !myIds.has(window.cleanId(pid)));
                if (m.parentOrders) {
                    Object.keys(m.parentOrders).forEach(k => {
                        if (myIds.has(window.cleanId(k))) delete m.parentOrders[k];
                    });
                }
            });

            treeNodes.forEach(node => {
                let m = menus.find(x => window.cleanId(x.id) === window.cleanId(node.id));
                if (!m) {
                    if (node.type === 'folder') {
                        m = { id: node.id, name: node.name, displayName: node.name, menuMode: 'folder', enabled: true, isEdited: true, parentId: null, parentIds: [], parentOrders: {}, createdBy: currentUser.id, isPoolItem: false };
                        menus.push(m);
                    } else return;
                }
                if (!m.parentIds) m.parentIds = [];
                if (!m.parentOrders) m.parentOrders = {};

                if (!m.parentIds.includes(node.parentId)) m.parentIds.push(node.parentId);
                m.parentOrders[node.parentId] = node.order;
                if (!m.parentId) m.parentId = node.parentId;
                // 注意：webpage 加入群組後仍保留 isPoolItem=true（池中目錄維持完整列表）
            });
        }

        window.appState.menus = menus;

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('menuNodeModal');
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (error) { console.error("[saveMenuNodeItem] 錯誤:", error); }
    return false;
}

function deleteMenuNodeItem(id) {
    try {
        customConfirm('確定要刪除此選單配置嗎？(底下包含的子看板將會被釋放回池中，不會被刪除)', () => {
            let menus = getCustomMenus();

            // 1) 找出所有要被一併刪除的子群組（folder 才連帶刪；網頁只解除關聯，不刪除）
            let oldDescendants = [];
            let visitedDesc = new Set();
            function getOldDesc(pId) {
                if (visitedDesc.has(pId)) return;
                visitedDesc.add(pId);
                menus.filter(m => m.menuMode === 'folder' && m.id !== pId && (window.isParentMatch(m.parentId, { id: pId }) || (m.parentIds || []).some(x => window.isParentMatch(x, { id: pId }))))
                    .forEach(m => { oldDescendants.push(m.id); getOldDesc(m.id); });
            }
            getOldDesc(id);

            // 2) 清除「以這些 id 為父」的關聯；只有「真的被影響到且現在變孤兒的非 folder」才回到池中。
            //    不要對其他不相干的 root 動 isPoolItem，否則整張表會被清空。
            const linkageToClear = [id, ...oldDescendants].map(x => window.cleanId(x));
            menus.forEach(x => {
                if (linkageToClear.includes(window.cleanId(x.id))) return; // 跳過待刪除節點本身
                let wasAffected = false;
                if (linkageToClear.includes(window.cleanId(x.parentId))) {
                    x.parentId = null;
                    wasAffected = true;
                }
                if (x.parentIds) {
                    const before = x.parentIds.length;
                    x.parentIds = x.parentIds.filter(pid => !linkageToClear.includes(window.cleanId(pid)));
                    if (x.parentIds.length !== before) wasAffected = true;
                }
                if (x.parentOrders) {
                    linkageToClear.forEach(pid => delete x.parentOrders[pid]);
                }
                if (wasAffected
                    && !x.parentId
                    && (!x.parentIds || x.parentIds.length === 0)
                    && (x.menuMode || '').toLowerCase() !== 'folder') {
                    x.isPoolItem = true;
                }
            });

            // 3) 實際刪除：本節點 + 所有子群組 folder
            menus = menus.filter(m =>
                window.cleanId(m.id) !== window.cleanId(id) &&
                !oldDescendants.includes(m.id)
            );
            window.appState.menus = menus;

            if (typeof syncDataToDB === 'function') syncDataToDB();
            if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
            if (typeof renderWebpageTable === 'function') renderWebpageTable();
            if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        });
    } catch (e) { console.error("[deleteMenuNodeItem] 錯誤:", e); }
}

// ⭐️ 新增：全域狀態開關連動邏輯
window.toggleMenuEnable = function (id, isEnabled) {
    let menus = getCustomMenus();
    let m = menus.find(x => window.cleanId(x.id) === window.cleanId(id));
    if (m) {
        m.enabled = isEnabled;
        window.appState.menus = menus;
        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    }
};

// === 拖曳全域輔助 (表格重新排序使用) ===
function handleDragStart(e, id, parentId) {
    if (e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { e.preventDefault(); return; }
    dragSrcEl = e.target.closest('tr'); if (!dragSrcEl) return;
    dragSrcId = id; dragSrcParentId = parentId;
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id);
    setTimeout(() => { if (dragSrcEl) dragSrcEl.classList.add('dragging'); }, 0);
}
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const tr = e.target.closest('tr'); if (tr && tr !== dragSrcEl && tr.classList.contains('draggable-row')) tr.classList.add('drag-over'); return false; }
function handleDragLeave(e) { const tr = e.target.closest('tr'); if (tr) tr.classList.remove('drag-over'); }
function handleDrop(e, targetId, targetParentId, mode) {
    e.stopPropagation(); const tr = e.target.closest('tr'); if (tr) tr.classList.remove('drag-over');
    if (dragSrcEl) dragSrcEl.classList.remove('dragging');
    if (dragSrcId === targetId) return false;

    if (mode === 'system') reorderSystemMenu(dragSrcId, targetId, targetParentId);
    else if (mode === 'webpage') reorderWebpageMenu(dragSrcId, targetId);
    else if (mode === 'personal') reorderPersonalMenu(dragSrcId, targetId, targetParentId);
    return false;
}

function reorderSystemMenu(srcId, targetId, parentId) {
    const pId = (!parentId || parentId === 'null') ? null : parentId;
    let menus = getCustomMenus();

    // ⭐️ 核心修復：精準比對，當拖曳的是主選單(Root)時，需採用與 Table 相同的過濾邏輯
    let siblings = [];
    if (pId === null) {
        siblings = menus.filter(m => {
            if (String(m.isPoolItem).toLowerCase() === 'true') return false;
            let hasValidParent = menus.some(pNode => pNode.id !== m.id && (window.isParentMatch(m.parentId, pNode) || (m.parentIds || []).some(pid => window.isParentMatch(pid, pNode))));
            return !hasValidParent;
        });
    } else {
        siblings = menus.filter(m => String(m.isPoolItem).toLowerCase() !== 'true' && (window.cleanId(m.parentId) === window.cleanId(pId) || (m.parentIds && m.parentIds.some(pid => window.cleanId(pid) === window.cleanId(pId)))));
    }

    siblings.sort((a, b) => (a.parentOrders?.[pId] ?? a.order ?? 0) - (b.parentOrders?.[pId] ?? b.order ?? 0));

    const srcIdx = siblings.findIndex(m => window.cleanId(m.id) === window.cleanId(srcId));
    const targetIdx = siblings.findIndex(m => window.cleanId(m.id) === window.cleanId(targetId));
    if (srcIdx > -1 && targetIdx > -1) {
        const [movedItem] = siblings.splice(srcIdx, 1);
        siblings.splice(targetIdx, 0, movedItem);
        siblings.forEach((s, idx) => {
            const realMenu = menus.find(x => window.cleanId(x.id) === window.cleanId(s.id));
            if (realMenu) {
                if (pId === null) realMenu.order = idx * 10;
                else {
                    if (!realMenu.parentOrders) realMenu.parentOrders = {};
                    realMenu.parentOrders[pId] = idx * 10;
                }
            }
        });

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    }
}

function reorderPersonalMenu(srcId, targetId, parentId) {
    const pId = (!parentId || parentId === 'null' || parentId === '') ? null : parentId;
    let pSets = getPersonalSettings(currentUser.id);
    let menus = getCustomMenus();

    // 個人模式拖曳：當 pId 為 null 時抓「無父節點且非池中項目」的 root（與上方導覽列一致）
    let siblings;
    if (pId === null) {
        siblings = menus.filter(m =>
            String(m.isPoolItem || m.IsPoolItem).toLowerCase() !== 'true' &&
            !m.parentId &&
            (!m.parentIds || m.parentIds.length === 0)
        );
    } else {
        siblings = menus.filter(m =>
            window.cleanId(m.parentId) === window.cleanId(pId) ||
            (m.parentIds && m.parentIds.some(pid => window.cleanId(pid) === window.cleanId(pId)))
        );
    }

    siblings.forEach(s => {
        const personalOrder = pSets[s.id] && pSets[s.id].order;
        s.tempOrder = (personalOrder != null) ? personalOrder : (s.order || 999);
    });
    siblings.sort((a, b) => a.tempOrder - b.tempOrder);

    const srcIdx = siblings.findIndex(m => window.cleanId(m.id) === window.cleanId(srcId));
    const targetIdx = siblings.findIndex(m => window.cleanId(m.id) === window.cleanId(targetId));
    if (srcIdx === -1 || targetIdx === -1) return;

    const [movedItem] = siblings.splice(srcIdx, 1);
    siblings.splice(targetIdx, 0, movedItem);
    siblings.forEach((m, idx) => {
        if (!pSets[m.id]) pSets[m.id] = {};
        pSets[m.id].order = idx * 10;
    });
    savePersonalSettings(currentUser.id, pSets);

    // 自動同步至 DB
    if (typeof syncDataToDB === 'function') syncDataToDB();

    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
}

function reorderWebpageMenu(srcId, targetId) {
    let menus = getCustomMenus();
    const srcIdx = menus.findIndex(m => window.cleanId(m.id) === window.cleanId(srcId));
    const targetIdx = menus.findIndex(m => window.cleanId(m.id) === window.cleanId(targetId));
    if (srcIdx > -1 && targetIdx > -1) {
        const [movedItem] = menus.splice(srcIdx, 1);
        menus.splice(targetIdx, 0, movedItem);
        menus.forEach((m, idx) => m.order = idx * 10);

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof renderWebpageTable === 'function') renderWebpageTable();
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    }
}

function rmDragStart(e, id) { rmDragSrcId = id; rmDragSrcEl = e.target.closest('.role-menu-item'); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => { if (rmDragSrcEl) rmDragSrcEl.classList.add('dragging'); }, 0); }
function rmDragOver(e) { e.preventDefault(); const item = e.target.closest('.role-menu-item'); if (item && item !== rmDragSrcEl) item.style.borderLeft = '4px solid #dc3545'; }
function rmDragLeave(e) { const item = e.target.closest('.role-menu-item'); if (item) item.style.borderLeft = ''; }
function rmDrop(e, targetId) {
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.role-menu-item').forEach(el => { el.classList.remove('dragging'); el.style.borderLeft = ''; });
    if (!rmDragSrcId || rmDragSrcId === targetId) return;

    const container = document.getElementById('roleMenuCheckboxes');
    const items = Array.from(container.children);
    const srcEl = items.find(el => window.cleanId(el.querySelector('.role-menu-cb').value) === window.cleanId(rmDragSrcId));
    const targetEl = items.find(el => window.cleanId(el.querySelector('.role-menu-cb').value) === window.cleanId(targetId));

    if (srcEl && targetEl) {
        const srcIdx = items.indexOf(srcEl);
        const tgtIdx = items.indexOf(targetEl);
        if (srcIdx < tgtIdx) targetEl.after(srcEl);
        else targetEl.before(srcEl);
    }
    rmDragSrcId = null;
}

// === App Grid ===
function openAppGridPage(menuId, title, element) {
    currentAppGridMenuId = menuId;
    document.getElementById('app-grid-title').innerText = title || '應用集合';
    if (typeof navTo === 'function') navTo('page-app-grid', element, title);
    const apps = getAppItems().filter(a => window.cleanId(a.menuId) === window.cleanId(menuId));
    if (typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', apps);
}

function openAppGridModal(id = null) {
    try {
        document.getElementById('appForm').reset();
        document.getElementById('appIdInput').value = id || '';
        document.getElementById('appIconPreview').style.display = 'none';
        document.getElementById('appIconPreview').src = '';

        if (id) {
            const app = getAppItems().find(a => window.cleanId(a.id) === window.cleanId(id));
            if (app) {
                document.getElementById('appName').value = app.name;
                document.getElementById('appUrl').value = app.url;
                document.getElementById('appTarget').value = app.target || '_blank';
                if (app.iconBase64) {
                    document.getElementById('appIconPreview').style.display = 'block';
                    document.getElementById('appIconPreview').src = app.iconBase64;
                }
            }
        }
        showModalSafely('appGridModal');
    } catch (e) { console.error("[openAppGridModal] 錯誤:", e); }
}

function saveAppItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('appIdInput').value;
        const name = document.getElementById('appName').value.trim();
        const url = document.getElementById('appUrl').value.trim();
        const target = document.getElementById('appTarget').value;
        const iconSrc = document.getElementById('appIconPreview').src;
        const finalIcon = document.getElementById('appIconPreview').style.display === 'block' ? iconSrc : '';

        let apps = getAppItems();
        if (id) {
            let idx = apps.findIndex(a => window.cleanId(a.id) === window.cleanId(id));
            if (idx > -1) { apps[idx].name = name; apps[idx].url = url; apps[idx].target = target; apps[idx].iconBase64 = finalIcon; }
        } else {
            apps.push({ id: 'app_' + Date.now(), menuId: currentAppGridMenuId, name: name, url: url, target: target, iconBase64: finalIcon });
        }

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('appGridModal');
        if (currentAppGridMenuId && typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', getAppItems().filter(a => window.cleanId(a.menuId) === window.cleanId(currentAppGridMenuId)));

    } catch (error) { console.error("[saveAppItem] 錯誤:", error); }
    return false;

}

function deleteAppItem(id) {
    try {
        customConfirm('確定要刪除此 APP 嗎？', () => {
            let apps = getAppItems().filter(a => window.cleanId(a.id) !== window.cleanId(id));
            window.appState.apps = apps;

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

            if (currentAppGridMenuId && typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', apps.filter(a => window.cleanId(a.menuId) === window.cleanId(currentAppGridMenuId)));
        });
    } catch (e) { console.error("[deleteAppItem] 錯誤:", e); }
}

function handleAppIconUpload(e) {
    const file = e.target.files[0];
    if (file) {
        compressImageFile(file, function (base64Str) {
            if (base64Str.length > 32700) {
                customAlert("圖檔太複雜，無法壓縮至安全大小，請更換較簡單的圖標。");
                document.getElementById('appIconPreview').style.display = 'none';
                e.target.value = '';
            } else {
                document.getElementById('appIconPreview').src = base64Str;
                document.getElementById('appIconPreview').style.display = 'block';
            }
        });
    }
}

// === Apply & Audit 申請與審核 ===
function openApplyModal(id = null) {
    try {
        const reasonInput = document.getElementById('applyReason');
        const idInput = document.getElementById('applyReqId');
        const typeInput = document.getElementById('applyType');
        const fabInput = document.getElementById('applyFab');

        if (id) {
            const req = getRequests().find(r => window.cleanId(r.id) === window.cleanId(id));
            if (req) {
                reasonInput.value = req.reason; idInput.value = req.id;
                if (typeInput) typeInput.value = req.reqType || '權限開通';
                if (fabInput) fabInput.value = req.fab || '全域 (Global)';
            }
        } else {
            reasonInput.value = ''; idInput.value = '';
            if (typeInput) typeInput.value = '權限開通';
            if (fabInput) fabInput.value = '全域 (Global)';
        }

        showModalSafely('applyModal');
    } catch (e) { console.error("[openApplyModal] 錯誤:", e); }
}

function submitApplyItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('applyReqId').value;
        const reason = document.getElementById('applyReason').value.trim();
        const reqType = document.getElementById('applyType') ? document.getElementById('applyType').value : '系統需求';
        const fab = document.getElementById('applyFab') ? document.getElementById('applyFab').value : '全域';

        if (!reason) return false;

        let reqs = getRequests();
        if (id) {
            let idx = reqs.findIndex(r => window.cleanId(r.id) === window.cleanId(id));
            if (idx > -1) {
                reqs[idx].reason = reason; reqs[idx].reqType = reqType; reqs[idx].fab = fab;
                reqs[idx].status = 'pending'; reqs[idx].timestamp = Date.now(); reqs[idx].withdrawReason = '';
            }
        } else {
            reqs.push({
                id: 'req_' + Date.now(), empId: currentUser.id, empName: currentUser.name,
                reqType: reqType, fab: fab, reason: reason, timestamp: Date.now(),
                status: 'pending', reply: ''
            });
        }

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('applyModal');

        if (typeof renderApplyTable === 'function') renderApplyTable();
        customAlert(id ? '需求申請已重新送出！' : '您的需求申請已成功送出！系統管理員將盡快為您處理。');
    } catch (error) { console.error("[submitApplyItem] 錯誤:", error); }
    return false;
}

// 對齊 TEST_20260429.html 申請紀錄刪除：撤回後可由使用者手動清除該筆
window.deleteApplyItem = function (id) {
    if (typeof customConfirm !== 'function') return;
    customConfirm('確定要刪除此申請紀錄嗎？', () => {
        let reqs = getRequests().filter(r => window.cleanId(r.id || r.RequestId) !== window.cleanId(id));
        window.appState.requests = reqs;
        if (typeof syncDataToDB === 'function') syncDataToDB();
        if (typeof renderApplyTable === 'function') renderApplyTable();
    });
};

function withdrawApply(id) {
    try {
        document.getElementById('withdrawReqId').value = id;
        document.getElementById('withdrawReason').value = '';
        showModalSafely('withdrawModal');
    } catch (e) { console.error("[withdrawApply] 錯誤:", e); }
}

function submitWithdrawItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('withdrawReqId').value;
        let reqs = getRequests();
        reqs = reqs.filter(r => window.cleanId(r.id) !== window.cleanId(id));
        window.appState.requests = reqs;

        // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('withdrawModal');
        if (typeof renderApplyTable === 'function') renderApplyTable();
    } catch (error) { console.error("[submitWithdrawItem] 錯誤:", error); }
    return false;
}

function openAuditModal(id) {
    try {
        const r = getRequests().find(x => window.cleanId(x.id) === window.cleanId(id));
        if (!r) { console.error("找不到對應的申請資料 (ID: " + id + ")"); return; }

        document.getElementById('auditReqId').value = r.id;
        document.getElementById('auditApplicant').value = `${r.empName} (${r.empId})`;

        let dateStr = r.timestamp;
        if (typeof r.timestamp === 'number') {
            let now = new Date(r.timestamp); let pad = (n) => n < 10 ? '0' + n : n;
            dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        document.getElementById('auditTime').value = dateStr;

        document.getElementById('auditType').value = r.reqType || '系統需求';
        document.getElementById('auditFab').value = r.fab || '全域 (Global)';
        document.getElementById('auditReasonDisplay').innerText = r.reason;
        document.getElementById('auditStatus').value = r.status || 'pending';
        document.getElementById('auditReply').value = r.reply || '';

        showModalSafely('auditModal');
    } catch (e) { console.error("[openAuditModal] 錯誤:", e); }
}

function saveAuditItem(e) {
    // ⭐️ 核心防重整
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    else if (window.event && typeof window.event.preventDefault === 'function') window.event.preventDefault();

    try {
        const id = document.getElementById('auditReqId').value;
        const status = document.getElementById('auditStatus').value;
        const reply = document.getElementById('auditReply').value.trim();

        let reqs = getRequests();
        let idx = reqs.findIndex(x => window.cleanId(x.id) === window.cleanId(id));
        if (idx > -1) {
            reqs[idx].status = status; reqs[idx].reply = reply;

            // 異動立即靜默同步到 DB（一般操作不需手動觸發）
        if (typeof syncDataToDB === 'function') syncDataToDB();
        }

        hideModalSafely('auditModal');

        if (typeof renderAuditTable === 'function') renderAuditTable();
        customAlert("已成功儲存並同步回覆狀態給使用者！");

    } catch (error) { console.error("[saveAuditItem] 錯誤:", error); }
    return false;

}

// === Excel 匯出備份（對齊 TEST_20260429.html:2186-2259）===
function createWorkbookData() {
    if (typeof XLSX === 'undefined') { customAlert('SheetJS 套件未載入'); return null; }
    const wb = XLSX.utils.book_new();

    const appendSafeData = (data, sheetName) => {
        if (!data || data.length === 0) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{}]), sheetName);
            return;
        }
        const safeData = data.map(item => {
            let processed = {};
            for (let key in item) {
                let val = item[key];
                let finalStr = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : (val !== undefined ? String(val) : '');
                if (finalStr.length > 32700) {
                    processed[key] = finalStr.startsWith('data:image') ? '' : (finalStr.substring(0, 32700) + '...');
                } else {
                    processed[key] = finalStr;
                }
            }
            return processed;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeData), sheetName);
    };

    const menus = getCustomMenus();
    const fabs = getFabs();
    const roles = getRoles();
    const accs = getAccounts();
    const apps = getAppItems();
    const reqs = getRequests();

    appendSafeData(menus.map(m => ({ MenuId: m.id, SysName: m.name, DisplayName: m.displayName, MenuMode: m.menuMode, Url: m.url || '', TargetPage: m.targetPage || '', OpenTarget: m.target || '', Icon: m.icon || '', CreatedBy: m.createdBy || 'admin', IsEnabled: m.enabled !== false, IsPoolItem: m.isPoolItem === true, IsEdited: m.isEdited === true, GlobalOrder: m.order || 0 })), "Menus");
    appendSafeData(fabs.map(f => ({ FabId: f.id, FabName: f.fabName, DisplayName: f.displayName, DefaultLang: f.defaultLang || 'zh' })), "Fabs");
    appendSafeData(roles.map(r => ({ RoleId: r.id, GroupName: r.groupName })), "Roles");
    appendSafeData(accs.map(a => ({ EmpId: a.empId, Name: a.name, Department: a.department || '', RoleLevel: a.roleLevel || 'user', CanEditOthers: a.canEditOthers === true })), "Accounts");
    appendSafeData(apps.map(a => ({ AppId: a.id, MenuId: a.menuId, AppName: a.name, Url: a.url || '', IconBase64: a.iconBase64 || '', Target: a.target || '_blank' })), "Apps");
    appendSafeData(reqs.map(r => ({ RequestId: r.id, EmpId: r.empId, EmpName: r.empName, Reason: r.reason, Timestamp: r.timestamp, Status: r.status, WithdrawReason: r.withdrawReason || '', Reply: r.reply || '' })), "Requests");

    let mapFabRole = []; fabs.forEach(f => { if (f.assignedRoles) f.assignedRoles.forEach(rId => mapFabRole.push({ FabId: f.id, RoleId: rId })); });
    appendSafeData(mapFabRole.length ? mapFabRole : [{ FabId: '', RoleId: '' }], "Map_Fab_Role");

    let mapAccRole = []; accs.forEach(a => { if (a.assignedRoles) a.assignedRoles.forEach(rId => mapAccRole.push({ EmpId: a.empId, RoleId: rId })); });
    appendSafeData(mapAccRole.length ? mapAccRole : [{ EmpId: '', RoleId: '' }], "Map_Account_Role");

    let mapAccMenu = []; accs.forEach(a => { if (a.manageableMenus) a.manageableMenus.forEach(mId => mapAccMenu.push({ EmpId: a.empId, MenuId: mId })); });
    appendSafeData(mapAccMenu.length ? mapAccMenu : [{ EmpId: '', MenuId: '' }], "Map_Account_ManageMenu");

    let mapRoleMenu = []; roles.forEach(r => { if (r.allowedMenuIds) r.allowedMenuIds.forEach((mId, idx) => mapRoleMenu.push({ RoleId: r.id, MenuId: mId, SortOrder: idx * 10 })); });
    appendSafeData(mapRoleMenu.length ? mapRoleMenu : [{ RoleId: '', MenuId: '', SortOrder: '' }], "Map_Role_Menu");

    let mapMenuStruct = []; menus.forEach(m => {
        if (m.parentIds && m.parentIds.length > 0) {
            m.parentIds.forEach(pId => mapMenuStruct.push({ ParentMenuId: pId, ChildMenuId: m.id, SortOrder: m.parentOrders ? (m.parentOrders[pId] || 0) : 0 }));
        } else if (m.parentId) {
            mapMenuStruct.push({ ParentMenuId: m.parentId, ChildMenuId: m.id, SortOrder: m.order || 0 });
        }
    });
    appendSafeData(mapMenuStruct.length ? mapMenuStruct : [{ ParentMenuId: '', ChildMenuId: '', SortOrder: '' }], "Map_Menu_Structure");

    let mapAccDefPage = []; accs.forEach(a => { if (a.defaultPages) { for (let fab in a.defaultPages) { mapAccDefPage.push({ EmpId: a.empId, FabId: fab, MenuId: a.defaultPages[fab] }); } } });
    appendSafeData(mapAccDefPage.length ? mapAccDefPage : [{ EmpId: '', FabId: '', MenuId: '' }], "Map_Account_DefaultPage");

    let pSettings = []; accs.forEach(a => {
        let pSet = getPersonalSettings(a.empId);
        if (pSet) for (let mId in pSet) {
            pSettings.push({ EmpId: a.empId, MenuId: mId, IsHidden: pSet[mId].hidden === true, OpenTarget: pSet[mId].target || '', Icon: pSet[mId].icon || '', SortOrder: pSet[mId].order !== undefined ? pSet[mId].order : '' });
        }
    });
    appendSafeData(pSettings.length ? pSettings : [{ EmpId: '', MenuId: '', IsHidden: '', OpenTarget: '', Icon: '', SortOrder: '' }], "PersonalSettings");

    return wb;
}

function exportConfig() {
    try {
        const wb = createWorkbookData();
        if (!wb) return;
        XLSX.writeFile(wb, "EQDashboard_Setting.xlsx");
    } catch (e) {
        console.error("[exportConfig] 錯誤:", e);
        if (typeof customAlert === 'function') customAlert("匯出 Excel 失敗：" + e.message);
    }
}
window.exportConfig = exportConfig;
window.createWorkbookData = createWorkbookData;

// === Icon Helpers ===
function handleIconSelectChange(prefix) {
    const sel = document.getElementById(prefix + 'Icon');
    const fileInput = document.getElementById(prefix + 'IconFile');
    if (sel.value === 'custom') { fileInput.style.display = 'block'; } else { fileInput.style.display = 'none'; }
}

function getSelectedIconVal(prefix) {
    let val = document.getElementById(prefix + 'Icon').value;
    if (val === 'custom') { return document.getElementById(prefix + 'CustomIconBase64').value || ''; }
    return val;
}

function setIconValToModal(prefix, iconVal) {
    if (iconVal && (iconVal.startsWith('data:image') || iconVal.startsWith('icon/'))) {
        document.getElementById(prefix + 'Icon').value = 'custom';
        document.getElementById(prefix + 'IconFile').style.display = 'block';
        document.getElementById(prefix + 'CustomIconBase64').value = iconVal;
    } else {
        document.getElementById(prefix + 'Icon').value = iconVal || '';
        document.getElementById(prefix + 'IconFile').style.display = 'none';
        document.getElementById(prefix + 'CustomIconBase64').value = '';
    }
}

function compressImageFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 80;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// === Excel 手動匯入與解析 ===
async function importConfig() {
    const fileInput = document.getElementById('configFile'); const file = fileInput.files[0];
    if (!file) return customAlert("請先選擇 Excel 檔案！");
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            await processAndSaveWorkbook(workbook, true);

            fileInput.value = '';
        } catch (err) {
            console.error(err);
            customAlert("匯入失敗，格式錯誤或網路異常。");
        }
    };
    reader.readAsArrayBuffer(file);
}

async function processAndSaveWorkbook(workbook, isManualImport = false) {
    const getSheetData = (sheetName) => {
        if (!workbook.Sheets[sheetName]) return [];
        return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    };

    const rawMenus = getSheetData("Menus"); const rawFabs = getSheetData("Fabs"); const rawRoles = getSheetData("Roles");
    const rawAccs = getSheetData("Accounts"); const rawApps = getSheetData("Apps"); const rawReqs = getSheetData("Requests");

    if (rawAccs.length > 0 && rawAccs[0].hasOwnProperty("EmpId")) {
        const mapFabRole = getSheetData("Map_Fab_Role"); const mapAccRole = getSheetData("Map_Account_Role");
        const mapAccMenu = getSheetData("Map_Account_ManageMenu"); const mapRoleMenu = getSheetData("Map_Role_Menu");
        const mapMenuStruct = getSheetData("Map_Menu_Structure"); const mapAccDefPage = getSheetData("Map_Account_DefaultPage");

        const finalAccs = rawAccs.filter(r => r.EmpId).map(row => {
            let empId = String(row.EmpId); let defPages = {};
            mapAccDefPage.filter(m => window.cleanId(m.EmpId) === window.cleanId(empId) && m.FabId && m.MenuId).forEach(m => { defPages[String(m.FabId)] = String(m.MenuId); });
            return {
                empId: empId, name: row.Name || '', department: row.Department || '',
                roleLevel: (row.RoleLevel || 'user').toLowerCase(),
                canEditOthers: String(row.CanEditOthers).toLowerCase() === 'true',
                defaultPages: defPages,
                assignedRoles: mapAccRole.filter(m => window.cleanId(m.EmpId) === window.cleanId(empId) && m.RoleId).map(m => String(m.RoleId)),
                manageableMenus: mapAccMenu.filter(m => window.cleanId(m.EmpId) === window.cleanId(empId) && m.MenuId).map(m => String(m.MenuId))
            };
        });

        const finalFabs = rawFabs.filter(r => r.FabId).map(row => {
            let fabId = String(row.FabId);
            return { id: fabId, fabName: row.FabName || fabId, displayName: row.DisplayName || '', defaultLang: (row.DefaultLang || 'zh').toLowerCase(), assignedRoles: mapFabRole.filter(m => window.cleanId(m.FabId) === window.cleanId(fabId) && m.RoleId).map(m => String(m.RoleId)) };
        });

        const finalRoles = rawRoles.filter(r => r.RoleId).map(row => {
            let roleId = String(row.RoleId);
            let allowed = mapRoleMenu.filter(m => window.cleanId(m.RoleId) === window.cleanId(roleId) && m.MenuId).sort((a, b) => parseInt(a.SortOrder || 0) - parseInt(b.SortOrder || 0)).map(m => String(m.MenuId));
            return { id: roleId, groupName: row.GroupName || '', allowedMenuIds: allowed };
        });

        const finalMenus = rawMenus.filter(r => r.MenuId).map(row => {
            let mId = String(row.MenuId);
            let m = { id: mId, name: row.SysName || '', displayName: row.DisplayName || '', menuMode: row.MenuMode || 'link', url: row.Url || '', targetPage: row.TargetPage || '', target: row.OpenTarget || 'iframe', icon: row.Icon || '', createdBy: row.CreatedBy || 'admin', enabled: String(row.IsEnabled).toLowerCase() !== 'false', isPoolItem: String(row.IsPoolItem).toLowerCase() === 'true', isEdited: String(row.IsEdited).toLowerCase() === 'true', order: parseInt(row.GlobalOrder || 0), parentId: null, parentIds: [], parentOrders: {} };
            let parents = mapMenuStruct.filter(s => window.cleanId(s.ChildMenuId) === window.cleanId(mId) && s.ParentMenuId);
            if (parents.length > 0) { m.parentId = String(parents[0].ParentMenuId); m.parentIds = parents.map(p => String(p.ParentMenuId)); parents.forEach(p => { m.parentOrders[String(p.ParentMenuId)] = parseInt(p.SortOrder || 0); }); }
            return m;
        });

        let finalApps = [];
        if (rawApps.length > 0) {
            finalApps = rawApps.filter(r => r.AppId || r.id).map(row => ({
                id: String(row.AppId || row.id || ''), menuId: String(row.MenuId || row.menuId || ''),
                name: row.AppName || row.name || '', url: row.Url || row.url || '',
                iconBase64: row.IconBase64 || row.iconBase64 || '', target: row.Target || row.target || '_blank'
            }));
        }

        let finalReqs = [];
        if (rawReqs.length > 0) {
            finalReqs = rawReqs.filter(r => r.RequestId || r.id).map(row => ({
                id: String(row.RequestId || row.id), empId: String(row.EmpId || row.empId),
                empName: row.EmpName || row.empName || '', reason: row.Reason || row.reason || '',
                timestamp: row.Timestamp || row.timestamp, status: row.Status || row.status || 'unreplied',
                withdrawReason: row.WithdrawReason || row.withdrawReason || '', reply: row.Reply || row.reply || ''
            }));
        }

        if (typeof window.appState !== 'undefined') {
            window.appState.accounts = finalAccs;
            window.appState.fabs = finalFabs;
            window.appState.roles = finalRoles;
            window.appState.menus = finalMenus;
            window.appState.apps = finalApps;
            window.appState.requests = finalReqs;
        }

    } else {
        const parseVal = (val) => {
            if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) { try { return JSON.parse(val); } catch (err) { return val; } }
            else if (val === 'true' || val === 'TRUE') return true;
            else if (val === 'false' || val === 'FALSE') return false;
            return val;
        };

        const oldMenus = rawMenus.filter(r => r.id).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });
        const oldFabs = rawFabs.filter(r => r.id).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });
        const oldRoles = rawRoles.filter(r => r.id).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });
        const oldAccs = rawAccs.filter(r => r.empId).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });
        const oldApps = rawApps.filter(r => r.id).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });
        const oldReqs = rawReqs.filter(r => r.id).map(row => { let p = {}; for (let k in row) p[k] = parseVal(row[k]); return p; });

        if (typeof window.appState !== 'undefined') {
            window.appState.menus = oldMenus;
            window.appState.fabs = oldFabs;
            window.appState.roles = oldRoles;
            window.appState.accounts = oldAccs;
            window.appState.apps = oldApps;
            window.appState.requests = oldReqs;
        }
    }

    if (isManualImport) {
        hasUnsavedChanges = false;
        if (typeof updateSyncButtonUI === 'function') updateSyncButtonUI();

        if (typeof syncDataToDB === 'function') {
            await syncDataToDB(true); // Excel 匯入時要顯示 loading 與完成訊息
            if (typeof initDashboardUI === 'function') initDashboardUI();
        }
    } else {
        hasUnsavedChanges = false;
        if (typeof updateSyncButtonUI === 'function') updateSyncButtonUI();
    }
}