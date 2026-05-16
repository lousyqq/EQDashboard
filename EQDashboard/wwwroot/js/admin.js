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
        console.warn("⚠️ 偵測到 Visual Studio BrowserLink 衝突，自動切換為【物理強制開窗模式】", error.message);
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
            e.preventDefault();
            e.stopPropagation();
            hideModalSafely(modalId);
        };
    });
}

function hideModalSafely(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;

    try {
        if (typeof bootstrap !== 'undefined') {
            const inst = bootstrap.Modal.getInstance(el);
            if (inst) inst.hide();
        }
    } catch (error) {
        console.warn("⚠️ 偵測到關窗衝突，自動切換為【物理強制關窗模式】", error.message);
    }

    // --- 物理強制關閉 (無差別執行，確保畫面乾淨) ---
    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('aria-modal');
    el.removeAttribute('role');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';

    // 清除所有卡住的背景黑罩
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
}

// === 權限檢查輔助 ===
function canManageFolderStructure(folderId) {
    if (!currentUser) return false;
    if (currentUser.roleLevel === 'admin') return true;
    if (!folderId) return true;

    const menus = getCustomMenus();
    const fNode = menus.find(m => m.id === folderId);
    if (!fNode) return true;

    if (fNode.createdBy === currentUser.id) return true;
    if (currentUser.manageableMenus && currentUser.manageableMenus.includes(folderId)) return true;

    let isUnderDelegated = false;
    let queue = [folderId];
    let visited = new Set();
    while (queue.length > 0) {
        let curr = queue.shift();
        if (currentUser.manageableMenus && currentUser.manageableMenus.includes(curr)) { isUnderDelegated = true; break; }
        visited.add(curr);
        let m = menus.find(x => x.id === curr);
        if (m) {
            if (m.parentId && !visited.has(m.parentId)) queue.push(m.parentId);
            if (m.parentIds) m.parentIds.forEach(p => { if (!visited.has(p)) queue.push(p); });
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
        const fab = getFabs().find(f => String(f.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('editFabId').value;
        const fabName = document.getElementById('fabNameInput').value.trim();
        const displayName = document.getElementById('fabDisplayNameInput').value.trim();
        const lang = document.getElementById('fabLangSelect').value;

        let assignedRoles = [];
        document.querySelectorAll('.fab-role-cb:checked').forEach(cb => assignedRoles.push(cb.value));

        let fabs = getFabs();
        if (id) {
            let f = fabs.find(x => String(x.id) === String(id));
            if (f) { f.displayName = displayName; f.defaultLang = lang; f.assignedRoles = assignedRoles; }
        } else {
            if (fabs.some(f => f.fabName.toLowerCase() === fabName.toLowerCase())) { customAlert('廠區ID已存在！'); return; }
            fabs.push({ id: 'fab_' + Date.now(), fabName: fabName, displayName: displayName || fabName, defaultLang: lang, assignedRoles: assignedRoles });
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('fabModal');
        if (typeof renderFabTable === 'function') renderFabTable();
        if (typeof renderFabSwitcher === 'function') renderFabSwitcher();
    } catch (e) { console.error("[saveFabItem] 錯誤:", e); }
}

function deleteFab(id) {
    try {
        customConfirm('確定要刪除此廠區嗎？', () => {
            let fabs = getFabs().filter(f => String(f.id) !== String(id));
            window.appState.fabs = fabs;

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
        const role = getRoles().find(r => String(r.id) === String(id));
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

function saveRoleItem(e) {
    try {
        e.preventDefault();
        const id = document.getElementById('editRoleId').value;
        const name = document.getElementById('roleName').value.trim();

        let allowed = [];
        document.querySelectorAll('.role-menu-item').forEach(el => {
            const cb = el.querySelector('.role-menu-cb');
            if (cb && cb.checked) allowed.push(cb.value);
        });

        let roles = getRoles();
        if (id) {
            let r = roles.find(x => String(x.id) === String(id));
            if (r) { r.groupName = name; r.allowedMenuIds = allowed; }
        } else {
            roles.push({ id: 'role_' + Date.now(), groupName: name, allowedMenuIds: allowed });
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('roleModal');
        if (typeof renderRoleTable === 'function') renderRoleTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (e) { console.error("[saveRoleItem] 錯誤:", e); }
}

function deleteRole(id) {
    try {
        customConfirm('確定要刪除此群組嗎？(若有廠區或帳號綁定此群組將自動解除)', () => {
            let roles = getRoles().filter(r => String(r.id) !== String(id));
            window.appState.roles = roles;

            let fabs = getFabs();
            fabs.forEach(f => { if (f.assignedRoles) f.assignedRoles = f.assignedRoles.filter(r => String(r) !== String(id)); });

            let accs = getAccounts();
            accs.forEach(a => { if (a.assignedRoles) a.assignedRoles = a.assignedRoles.filter(r => String(r) !== String(id)); });

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
        document.getElementById('accEmpId').readOnly = false;
        document.getElementById('accRoleLevel').value = 'user';
        document.getElementById('accRoleLevel').disabled = false;
        document.getElementById('accEnableDelegation').checked = false;
        document.getElementById('accRoleCheckboxesContainer').innerHTML = '<div id="accRoleCheckboxes" class="d-flex flex-wrap gap-1 mt-1"></div>';

        tempDefaultPages = {};
        toggleAccDelegationUI();

        if (typeof renderAccRoleCheckboxes === 'function') renderAccRoleCheckboxes([]);
        if (typeof renderAccManageMenuCheckboxes === 'function') renderAccManageMenuCheckboxes([]);
        if (typeof renderAccDefaultPagesUI === 'function') renderAccDefaultPagesUI();

        showModalSafely('accModal');
    } catch (e) { console.error("[openAddAccountModal] 錯誤:", e); }
}

function editAccount(empId) {
    try {
        const acc = getAccounts().find(a => String(a.empId) === String(empId));
        if (!acc) { console.error("找不到對應的帳號資料 (工號: " + empId + ")"); return; }

        document.getElementById('editAccMode').value = 'edit';
        document.getElementById('accEmpId').value = acc.empId; document.getElementById('accEmpId').disabled = true;
        document.getElementById('accName').value = acc.name || ''; document.getElementById('accDept').value = acc.department || '';
        document.getElementById('accRoleLevel').value = acc.roleLevel || 'user';
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
    try {
        e.preventDefault();
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
            let a = accs.find(x => String(x.empId) === String(empId));
            if (a) {
                a.name = name; a.department = dept; a.roleLevel = lvl;
                a.assignedRoles = assigned; a.manageableMenus = manageable;
                a.canEditOthers = canEditOthers; a.defaultPages = JSON.parse(JSON.stringify(tempDefaultPages));
            }
        } else {
            if (accs.some(a => a.empId.toLowerCase() === empId.toLowerCase())) { customAlert('工號已存在！'); return; }
            accs.push({
                empId: empId, name: name, department: dept, roleLevel: lvl,
                assignedRoles: assigned, manageableMenus: manageable,
                canEditOthers: canEditOthers, defaultPages: JSON.parse(JSON.stringify(tempDefaultPages))
            });
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('accModal');
        if (typeof renderAccountTable === 'function') renderAccountTable();

        if (currentUser && String(currentUser.id) === String(empId)) {
            currentUser.name = name; currentUser.department = dept; currentUser.roleLevel = lvl;
            currentUser.assignedRoles = assigned; currentUser.manageableMenus = manageable;
            currentUser.canEditOthers = canEditOthers; currentUser.defaultPages = JSON.parse(JSON.stringify(tempDefaultPages));
            localStorage.setItem('umc_current_user', JSON.stringify(currentUser));
        }
    } catch (e) { console.error("[saveAccountItem] 錯誤:", e); }
}

function deleteAccount(empId) {
    try {
        if (empId === 'admin') { customAlert('系統預設管理員無法刪除！'); return; }
        customConfirm('確定要刪除此帳號嗎？', () => {
            let accs = getAccounts().filter(a => String(a.empId) !== String(empId));
            window.appState.accounts = accs;

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

// === Personal Menus 個人選單 ===
function togglePerMenuExpand(id) {
    if (expandedPerMenuIds.has(id)) expandedPerMenuIds.delete(id);
    else expandedPerMenuIds.add(id);
    isPerAllExpanded = false;
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
}

function togglePerAllMenus() {
    isPerAllExpanded = !isPerAllExpanded;
    if (!isPerAllExpanded) expandedPerMenuIds.clear();
    if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
}

function restoreDefaultPersonalMenu() {
    customConfirm('確定要清除所有個人化設定，還原為系統預設版面嗎？', () => {
        localStorage.removeItem('umc_personal_menus_' + currentUser.id);

        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    });
}

function editPersonalMenu(id) {
    try {
        const menu = getCustomMenus().find(m => String(m.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('editPersonalMenuId').value;
        let pSets = getPersonalSettings(currentUser.id);
        if (!pSets[id]) pSets[id] = {};

        pSets[id].hidden = !document.getElementById('personalMenuVisible').checked;
        pSets[id].icon = getSelectedIconVal('personalMenu');

        const target = document.getElementById('personalMenuTarget').value;
        if (target) pSets[id].target = target; else delete pSets[id].target;

        savePersonalSettings(currentUser.id, pSets);

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('personalMenuModal');
        if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (e) { console.error("[savePersonalMenu] 錯誤:", e); }
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
            const m = getCustomMenus().find(x => String(x.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('editWpId').value;
        const isAppGrid = document.getElementById('wpModeAppGrid').checked;
        let menus = getCustomMenus();

        let mObj = id ? menus.find(x => String(x.id) === String(id)) : { id: 'm_' + Date.now(), isPoolItem: false, createdBy: currentUser.id, parentId: null, parentIds: [] };

        mObj.name = document.getElementById('wpSysName').value.trim();
        mObj.displayName = document.getElementById('wpDisplayName').value.trim();
        mObj.menuMode = isAppGrid ? 'app_grid' : 'link';
        mObj.icon = getSelectedIconVal('wp');
        mObj.enabled = true;
        mObj.isEdited = true;

        if (isAppGrid) {
            mObj.targetPage = 'page-app-grid'; mObj.url = ''; mObj.target = 'iframe';
        } else {
            let inputUrl = document.getElementById('wpUrl').value.trim();
            if (inputUrl.startsWith('page-')) { mObj.targetPage = inputUrl; mObj.url = ''; }
            else { mObj.url = inputUrl; mObj.targetPage = 'page-iframe'; }
            mObj.target = document.getElementById('wpTarget').value;
        }

        if (!id) { mObj.order = menus.length * 10; menus.push(mObj); }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('webpageModal');

        if (typeof renderWebpageTable === 'function') renderWebpageTable();
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (e) { console.error("[saveWebpageItem] 錯誤:", e); }
}

function deleteWebpageItem(id) {
    try {
        customConfirm('確定要刪除此看板嗎？', () => {
            let menus = getCustomMenus().filter(m => String(m.id) !== String(id));
            window.appState.menus = menus;

            if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderWebpageTable === 'function') renderWebpageTable();
            if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
            if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        });
    } catch (e) { console.error("[deleteWebpageItem] 錯誤:", e); }
}

// === Menus 結構管理 ===
function toggleNodeMode() {
    const isFolder = document.getElementById('nodeModeFolder').checked;
    document.getElementById('nodeUrlGroup').style.display = isFolder ? 'none' : 'block';
    document.getElementById('nodeTargetGroup').style.display = isFolder ? 'none' : 'block';
    document.getElementById('treeBuilderSection').style.display = isFolder ? 'block' : 'none';
}

function openAddMenuNodeModal(id = null) {
    try {
        document.getElementById('nodeForm').reset();
        document.getElementById('editNodeId').value = id || '';
        document.getElementById('nodeModeFolder').checked = true;
        toggleNodeMode();
        setIconValToModal('node', '');

        const menus = getCustomMenus();
        if (id) {
            const m = menus.find(x => String(x.id) === String(id));
            if (m) {
                if (m.menuMode !== 'folder') document.getElementById('nodeModeLink').checked = true;
                toggleNodeMode();

                document.getElementById('nodeName').value = m.name;
                document.getElementById('nodeDisplayName').value = m.displayName;
                document.getElementById('nodeUrl').value = m.url || m.targetPage || '';
                document.getElementById('nodeTarget').value = m.target || 'iframe';
                setIconValToModal('node', m.icon || '');

                if (m.menuMode === 'folder') {
                    currentTreeData = menus.filter(x => x.parentId === m.id || (x.parentIds && x.parentIds.includes(m.id)));
                    currentTreeData.sort((a, b) => (a.parentOrders?.[m.id] ?? a.order ?? 0) - (b.parentOrders?.[m.id] ?? b.order ?? 0));
                } else currentTreeData = [];
            }
        } else currentTreeData = [];

        if (typeof renderTreeBuilder === 'function') renderTreeBuilder();
        showModalSafely('menuNodeModal');
    } catch (e) { console.error("[openAddMenuNodeModal] 錯誤:", e); }
}

function saveMenuNodeItem(e) {
    try {
        e.preventDefault();
        const id = document.getElementById('editNodeId').value;
        const isFolder = document.getElementById('nodeModeFolder').checked;
        let menus = getCustomMenus();

        let mObj = id ? menus.find(x => String(x.id) === String(id)) : { id: 'm_' + Date.now(), isPoolItem: false, createdBy: currentUser.id, parentId: null, parentIds: [] };

        mObj.name = document.getElementById('nodeName').value.trim();
        mObj.displayName = document.getElementById('nodeDisplayName').value.trim();
        mObj.menuMode = isFolder ? 'folder' : 'link';
        mObj.icon = getSelectedIconVal('node');
        mObj.enabled = true;
        mObj.isEdited = true;

        if (!isFolder) {
            let inputUrl = document.getElementById('nodeUrl').value.trim();
            if (inputUrl.startsWith('page-')) { mObj.targetPage = inputUrl; mObj.url = ''; }
            else { mObj.url = inputUrl; mObj.targetPage = 'page-iframe'; }
            mObj.target = document.getElementById('nodeTarget').value;
        } else {
            mObj.url = ''; mObj.targetPage = '';
        }

        if (!id) { mObj.order = menus.length * 10; menus.push(mObj); }

        if (isFolder) {
            currentTreeData.forEach((child, idx) => {
                let realChild = menus.find(x => String(x.id) === String(child.id));
                if (realChild) {
                    if (!realChild.parentIds) realChild.parentIds = [];
                    if (!realChild.parentOrders) realChild.parentOrders = {};
                    if (!realChild.parentIds.includes(mObj.id)) realChild.parentIds.push(mObj.id);
                    if (realChild.parentId === null) realChild.parentId = mObj.id;
                    realChild.parentOrders[mObj.id] = idx * 10;
                }
            });

            menus.forEach(x => {
                if ((x.parentId === mObj.id || (x.parentIds && x.parentIds.includes(mObj.id))) && !currentTreeData.find(c => String(c.id) === String(x.id))) {
                    if (x.parentId === mObj.id) x.parentId = null;
                    if (x.parentIds) x.parentIds = x.parentIds.filter(pid => String(pid) !== String(mObj.id));
                    if (x.parentOrders) delete x.parentOrders[mObj.id];
                    if (!x.parentId && (!x.parentIds || x.parentIds.length === 0)) x.isPoolItem = true;
                }
            });
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('menuNodeModal');
        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    } catch (e) { console.error("[saveMenuNodeItem] 錯誤:", e); }
}

function deleteMenuNodeItem(id) {
    try {
        customConfirm('確定要刪除此選單配置嗎？(底下包含的子看板將會被釋放回池中，不會被刪除)', () => {
            let menus = getCustomMenus();
            menus.forEach(x => {
                if (x.parentId === id || (x.parentIds && x.parentIds.includes(id))) {
                    if (x.parentId === id) x.parentId = null;
                    if (x.parentIds) x.parentIds = x.parentIds.filter(pid => String(pid) !== String(id));
                    if (x.parentOrders) delete x.parentOrders[id];
                    if (!x.parentId && (!x.parentIds || x.parentIds.length === 0)) x.isPoolItem = true;
                }
            });
            menus = menus.filter(m => String(m.id) !== String(id));
            window.appState.menus = menus;

            if (typeof syncDataToDB === 'function') syncDataToDB();

            if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
            if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
        });
    } catch (e) { console.error("[deleteMenuNodeItem] 錯誤:", e); }
}

// === Tree Builder ===
function renderTreeBuilder() {
    const container = document.getElementById('treeBuilderContainer'); if (!container) return;
    let html = '';
    currentTreeData.forEach(item => {
        let iconHtml = typeof generateIconHtml === 'function' ? generateIconHtml(item.icon, 'text-muted', 'me-2', item.menuMode === 'folder') : '';
        html += `
        <div class="tb-item d-flex align-items-center justify-content-between p-2 mb-1 bg-white border rounded shadow-sm" draggable="true" ondragstart="tbDragStart(event, '${item.id}')" ondragover="tbDragOver(event)" ondragleave="tbDragLeave(event)" ondrop="tbDrop(event, '${item.id}')">
            <div class="fw-bold text-dark text-truncate" style="max-width:70%;"><i class="fas fa-grip-vertical text-muted me-2 opacity-50 cursor-pointer"></i>${iconHtml} ${item.displayName}</div>
            <div><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 border-0" onclick="tbRemoveItem('${item.id}')"><i class="fas fa-times"></i></button></div>
        </div>`;
    });
    if (currentTreeData.length === 0) html = '<div class="text-center text-muted small py-3"><i class="fas fa-info-circle mb-2 fs-4 opacity-50"></i><br>目前沒有包含任何項目</div>';
    container.innerHTML = html;
}

let tbDragSrcId = null;
function tbDragStart(e, id) { tbDragSrcId = id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.closest('.tb-item').classList.add('dragging'), 0); }
function tbDragOver(e) { e.preventDefault(); const tr = e.target.closest('.tb-item'); if (tr && tbDragSrcId) tr.classList.add('drag-over'); return false; }
function tbDragLeave(e) { const tr = e.target.closest('.tb-item'); if (tr) tr.classList.remove('drag-over'); }
function tbDrop(e, targetId) {
    e.stopPropagation(); document.querySelectorAll('.tb-item').forEach(el => { el.classList.remove('dragging', 'drag-over'); });
    if (!tbDragSrcId || tbDragSrcId === targetId) return false;

    const srcIdx = currentTreeData.findIndex(x => String(x.id) === String(tbDragSrcId));
    const tgtIdx = currentTreeData.findIndex(x => String(x.id) === String(targetId));
    if (srcIdx > -1 && tgtIdx > -1) {
        const [moved] = currentTreeData.splice(srcIdx, 1);
        currentTreeData.splice(tgtIdx, 0, moved);
        renderTreeBuilder();
    }
    tbDragSrcId = null; return false;
}
function tbRemoveItem(id) { currentTreeData = currentTreeData.filter(x => String(x.id) !== String(id)); renderTreeBuilder(); }

function tbAddWebpage(presetId = null) {
    const menus = getCustomMenus();
    let pool = menus.filter(m => m.menuMode !== 'folder' && !currentTreeData.find(c => String(c.id) === String(m.id)) && String(m.id) !== String(document.getElementById('editNodeId').value));
    if (pool.length === 0) return customAlert('目前沒有可加入的看板。');

    let optionsHtml = pool.map(m => `<option value="${m.id}">${m.displayName} (${m.name})</option>`).join('');
    let idString = 'modal_' + Date.now();
    let html = `
    <div class="modal fade" id="${idString}" tabindex="-1" style="z-index:1060;">
        <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-light border-bottom"><h6 class="modal-title fw-bold text-dark"><i class="fas fa-link text-primary me-2"></i>選擇現有看板加入</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body py-3">
                    <select id="sel_${idString}" class="form-select form-select-sm">${optionsHtml}</select>
                    <div class="mt-3 text-end"><button class="btn btn-sm btn-primary fw-bold" onclick="tbConfirmAdd('${idString}')">確定加入</button></div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    let modalEl = document.getElementById(idString);
    let bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
    modalEl.addEventListener('hidden.bs.modal', function () { modalEl.remove(); });
}

function tbConfirmAdd(modalId) {
    const sel = document.getElementById('sel_' + modalId);
    if (sel && sel.value) {
        const m = getCustomMenus().find(x => String(x.id) === String(sel.value));
        if (m) { currentTreeData.push(m); renderTreeBuilder(); }
    }
    bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
}
function tbAddFolder() { customAlert("子群組功能尚在開發中..."); }

// === App Grid ===
function openAppGridPage(menuId, title, element) {
    currentAppGridMenuId = menuId;
    document.getElementById('app-grid-title').innerText = title || '應用集合';
    if (typeof navTo === 'function') navTo('page-app-grid', element, title);
    const apps = getAppItems().filter(a => String(a.menuId) === String(menuId));
    if (typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', apps);
}

function openAppGridModal(id = null) {
    try {
        document.getElementById('appForm').reset();
        document.getElementById('appIdInput').value = id || '';
        document.getElementById('appIconPreview').style.display = 'none';
        document.getElementById('appIconPreview').src = '';

        if (id) {
            const app = getAppItems().find(a => String(a.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('appIdInput').value;
        const name = document.getElementById('appName').value.trim();
        const url = document.getElementById('appUrl').value.trim();
        const target = document.getElementById('appTarget').value;
        const iconSrc = document.getElementById('appIconPreview').src;
        const finalIcon = document.getElementById('appIconPreview').style.display === 'block' ? iconSrc : '';

        let apps = getAppItems();
        if (id) {
            let idx = apps.findIndex(a => String(a.id) === String(id));
            if (idx > -1) { apps[idx].name = name; apps[idx].url = url; apps[idx].target = target; apps[idx].iconBase64 = finalIcon; }
        } else {
            apps.push({ id: 'app_' + Date.now(), menuId: currentAppGridMenuId, name: name, url: url, target: target, iconBase64: finalIcon });
        }

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('appGridModal');
        if (currentAppGridMenuId && typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', getAppItems().filter(a => String(a.menuId) === String(currentAppGridMenuId)));
    } catch (e) { console.error("[saveAppItem] 錯誤:", e); }
}

function deleteAppItem(id) {
    try {
        customConfirm('確定要刪除此 APP 嗎？', () => {
            let apps = getAppItems().filter(a => String(a.id) !== String(id));
            window.appState.apps = apps;

            if (typeof syncDataToDB === 'function') syncDataToDB();

            if (currentAppGridMenuId && typeof renderAppGrid === 'function') renderAppGrid('app-grid-container', apps.filter(a => String(a.menuId) === String(currentAppGridMenuId)));
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
            const req = getRequests().find(r => String(r.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('applyReqId').value;
        const reason = document.getElementById('applyReason').value.trim();
        const reqType = document.getElementById('applyType') ? document.getElementById('applyType').value : '系統需求';
        const fab = document.getElementById('applyFab') ? document.getElementById('applyFab').value : '全域';

        if (!reason) return;

        let reqs = getRequests();
        if (id) {
            let idx = reqs.findIndex(r => String(r.id) === String(id));
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

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('applyModal');

        if (typeof renderApplyTable === 'function') renderApplyTable();
        customAlert(id ? '需求申請已重新送出！' : '您的需求申請已成功送出！系統管理員將盡快為您處理。');
    } catch (e) { console.error("[submitApplyItem] 錯誤:", e); }
}

function withdrawApply(id) {
    try {
        document.getElementById('withdrawReqId').value = id;
        document.getElementById('withdrawReason').value = '';
        showModalSafely('withdrawModal');
    } catch (e) { console.error("[withdrawApply] 錯誤:", e); }
}

function submitWithdrawItem(e) {
    try {
        e.preventDefault();
        const id = document.getElementById('withdrawReqId').value;
        let reqs = getRequests();
        reqs = reqs.filter(r => String(r.id) !== String(id));
        window.appState.requests = reqs;

        if (typeof syncDataToDB === 'function') syncDataToDB();

        hideModalSafely('withdrawModal');
        if (typeof renderApplyTable === 'function') renderApplyTable();
    } catch (e) { console.error("[submitWithdrawItem] 錯誤:", e); }
}

function openAuditModal(id) {
    try {
        const r = getRequests().find(x => String(x.id) === String(id));
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
    try {
        e.preventDefault();
        const id = document.getElementById('auditReqId').value;
        const status = document.getElementById('auditStatus').value;
        const reply = document.getElementById('auditReply').value.trim();

        let reqs = getRequests();
        let idx = reqs.findIndex(x => String(x.id) === String(id));
        if (idx > -1) {
            reqs[idx].status = status; reqs[idx].reply = reply;

            if (typeof syncDataToDB === 'function') syncDataToDB();
        }

        hideModalSafely('auditModal');

        if (typeof renderAuditTable === 'function') renderAuditTable();
        customAlert("已成功儲存並同步回覆狀態給使用者！");
    } catch (e) { console.error("[saveAuditItem] 錯誤:", e); }
}

// === Drag & Drop 總控制核心 ===
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
    let siblings = menus.filter(m => String(m.isPoolItem).toLowerCase() !== 'true' && (m.parentId === pId || (m.parentIds && m.parentIds.includes(pId))));
    siblings.sort((a, b) => (a.parentOrders?.[pId] ?? a.order ?? 0) - (b.parentOrders?.[pId] ?? b.order ?? 0));

    const srcIdx = siblings.findIndex(m => String(m.id) === String(srcId));
    const targetIdx = siblings.findIndex(m => String(m.id) === String(targetId));
    if (srcIdx > -1 && targetIdx > -1) {
        const [movedItem] = siblings.splice(srcIdx, 1);
        siblings.splice(targetIdx, 0, movedItem);
        siblings.forEach((s, idx) => {
            const realMenu = menus.find(x => String(x.id) === String(s.id));
            if (realMenu) {
                if (pId === null) realMenu.order = idx * 10;
                else {
                    if (!realMenu.parentOrders) realMenu.parentOrders = {};
                    realMenu.parentOrders[pId] = idx * 10;
                }
            }
        });

        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    }
}

function reorderPersonalMenu(srcId, targetId, parentId) {
    const pId = (!parentId || parentId === 'null') ? null : parentId;
    let pSets = getPersonalSettings(currentUser.id);
    let menus = getCustomMenus();
    let siblings = menus.filter(m => m.parentId === pId || (m.parentIds && m.parentIds.includes(pId)));

    siblings.forEach(s => { s.tempOrder = pSets[s.id]?.order ?? s.order ?? 999; });
    siblings.sort((a, b) => a.tempOrder - b.tempOrder);

    const srcIdx = siblings.findIndex(m => String(m.id) === String(srcId));
    const targetIdx = siblings.findIndex(m => String(m.id) === String(targetId));

    if (srcIdx > -1 && targetIdx > -1) {
        const [movedItem] = siblings.splice(srcIdx, 1);
        siblings.splice(targetIdx, 0, movedItem);
        siblings.forEach((m, idx) => {
            if (!pSets[m.id]) pSets[m.id] = {};
            pSets[m.id].order = idx * 10;
        });
        savePersonalSettings(currentUser.id, pSets);

        if (typeof syncDataToDB === 'function') syncDataToDB();

        if (typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    }
}

function reorderWebpageMenu(srcId, targetId) {
    let menus = getCustomMenus();
    const srcIdx = menus.findIndex(m => String(m.id) === String(srcId));
    const targetIdx = menus.findIndex(m => String(m.id) === String(targetId));
    if (srcIdx > -1 && targetIdx > -1) {
        const [movedItem] = menus.splice(srcIdx, 1);
        menus.splice(targetIdx, 0, movedItem);
        menus.forEach((m, idx) => m.order = idx * 10);

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
    const srcEl = items.find(el => String(el.querySelector('.role-menu-cb').value) === String(rmDragSrcId));
    const targetEl = items.find(el => String(el.querySelector('.role-menu-cb').value) === String(targetId));

    if (srcEl && targetEl) {
        const srcIdx = items.indexOf(srcEl);
        const tgtIdx = items.indexOf(targetEl);
        if (srcIdx < tgtIdx) targetEl.after(srcEl);
        else targetEl.before(srcEl);
    }
    rmDragSrcId = null;
}

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

// === Excel 手動匯入與解析 (與 DB 完美連動版) ===
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
            mapAccDefPage.filter(m => String(m.EmpId) === empId && m.FabId && m.MenuId).forEach(m => { defPages[String(m.FabId)] = String(m.MenuId); });
            return {
                empId: empId, name: row.Name || '', department: row.Department || '',
                roleLevel: (row.RoleLevel || 'user').toLowerCase(),
                canEditOthers: String(row.CanEditOthers).toLowerCase() === 'true',
                defaultPages: defPages,
                assignedRoles: mapAccRole.filter(m => String(m.EmpId) === empId && m.RoleId).map(m => String(m.RoleId)),
                manageableMenus: mapAccMenu.filter(m => String(m.EmpId) === empId && m.MenuId).map(m => String(m.MenuId))
            };
        });

        const finalFabs = rawFabs.filter(r => r.FabId).map(row => {
            let fabId = String(row.FabId);
            return { id: fabId, fabName: row.FabName || fabId, displayName: row.DisplayName || '', defaultLang: (row.DefaultLang || 'zh').toLowerCase(), assignedRoles: mapFabRole.filter(m => String(m.FabId) === fabId && m.RoleId).map(m => String(m.RoleId)) };
        });

        const finalRoles = rawRoles.filter(r => r.RoleId).map(row => {
            let roleId = String(row.RoleId);
            let allowed = mapRoleMenu.filter(m => String(m.RoleId) === roleId && m.MenuId).sort((a, b) => parseInt(a.SortOrder || 0) - parseInt(b.SortOrder || 0)).map(m => String(m.MenuId));
            return { id: roleId, groupName: row.GroupName || '', allowedMenuIds: allowed };
        });

        const finalMenus = rawMenus.filter(r => r.MenuId).map(row => {
            let mId = String(row.MenuId);
            let m = { id: mId, name: row.SysName || '', displayName: row.DisplayName || '', menuMode: row.MenuMode || 'link', url: row.Url || '', targetPage: row.TargetPage || '', target: row.OpenTarget || 'iframe', icon: row.Icon || '', createdBy: row.CreatedBy || 'admin', enabled: String(row.IsEnabled).toLowerCase() !== 'false', isPoolItem: String(row.IsPoolItem).toLowerCase() === 'true', isEdited: String(row.IsEdited).toLowerCase() === 'true', order: parseInt(row.GlobalOrder || 0), parentId: null, parentIds: [], parentOrders: {} };
            let parents = mapMenuStruct.filter(s => String(s.ChildMenuId) === mId && s.ParentMenuId);
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
            await syncDataToDB();
            if (typeof initDashboardUI === 'function') initDashboardUI();
        }
    } else {
        hasUnsavedChanges = false;
        if (typeof updateSyncButtonUI === 'function') updateSyncButtonUI();
    }
}