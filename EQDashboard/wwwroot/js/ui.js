// ====== UI 交互與畫面控制邏輯 ======

// ⭐️ 終極 ID 洗淨器：強行脫去所有括號、引號、空白與大小寫差異
window.cleanId = function (id) {
    if (id == null) return '';
    return String(id).replace(/[\[\]"']/g, '').trim().toLowerCase();
};

// 切換側邊欄
function toggleSidebar() {
    let hasChildren = false;
    if (window.currentActiveTopMenuId === 'system_settings') {
        hasChildren = true;
    } else if (window.currentActiveTopMenuId) {
        const cTargetId = window.cleanId(window.currentActiveTopMenuId);
        const menus = getCustomMenus();
        const children = menus.filter(m => window.cleanId(m.parentId) === cTargetId || (m.parentIds || []).map(window.cleanId).includes(cTargetId));
        if (children.length > 0) hasChildren = true;
    }

    if (!hasChildren) {
        document.body.classList.add('sidebar-hidden');
        return;
    }
    document.body.classList.toggle('sidebar-hidden');
}

// 切換釘選/自動隱藏模式
function togglePin() {
    isPinned = !isPinned;
    const btnPin = document.getElementById('btn-pin');

    if (isPinned) {
        document.body.classList.remove('nav-hidden');
        let hasChildren = false;
        if (window.currentActiveTopMenuId === 'system_settings') {
            hasChildren = true;
        } else if (window.currentActiveTopMenuId) {
            const cTargetId = window.cleanId(window.currentActiveTopMenuId);
            const menus = getCustomMenus();
            const children = menus.filter(m => window.cleanId(m.parentId) === cTargetId || (m.parentIds || []).map(window.cleanId).includes(cTargetId));
            if (children.length > 0) hasChildren = true;
        }

        if (hasChildren) {
            document.body.classList.remove('sidebar-hidden');
        } else {
            document.body.classList.add('sidebar-hidden');
        }

        if (btnPin) {
            btnPin.classList.add('is-pinned');
            if (btnPin.innerHTML.includes('自動隱藏')) {
                btnPin.innerHTML = '<i class="fas fa-thumbtack text-primary"></i> 已固定版面';
            } else {
                btnPin.innerHTML = '<i class="fas fa-thumbtack text-danger" style="font-size: 0.9rem;"></i>';
                btnPin.style.background = 'transparent';
                btnPin.style.color = 'inherit';
            }
        }
    } else {
        if (btnPin) {
            btnPin.classList.remove('is-pinned');
            if (btnPin.innerHTML.includes('已固定版面')) {
                btnPin.innerHTML = '<i class="fas fa-expand-arrows-alt"></i> 自動隱藏';
            } else {
                btnPin.innerHTML = '<i class="fas fa-unlock text-white-50" style="font-size: 0.9rem;"></i>';
                btnPin.style.background = 'transparent';
                btnPin.style.color = 'inherit';
            }
        }
    }
}

// 切換全螢幕
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen-mode');
    if (document.body.classList.contains('fullscreen-mode')) {
        if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(err => console.log(err)); }
    } else {
        if (document.fullscreenElement) { document.exitFullscreen().catch(err => console.log(err)); }
    }
}

// 切換系統/自訂版面
function switchLayoutMode(mode) {
    currentLayoutMode = mode;
    const btnSys = document.getElementById('btn-layout-system');
    const btnPer = document.getElementById('btn-layout-personal');
    const wrapper = document.getElementById('layout-toggle-wrapper');

    if (mode === 'system') {
        if (btnSys) btnSys.classList.add('active');
        if (btnPer) btnPer.classList.remove('active');
        if (wrapper) wrapper.classList.remove('personal-active');
    } else {
        if (btnPer) btnPer.classList.add('active');
        if (btnSys) btnSys.classList.remove('active');
        if (wrapper) wrapper.classList.add('personal-active');
    }
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
}

// 切換語言
function changeLanguage(lang) {
    currentLang = lang;
    if (typeof i18n !== 'undefined') {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang] && i18n[lang][key]) el.innerHTML = i18n[lang][key];
        });
    }
    const langCodes = { 'zh': 'ZH', 'en': 'EN', 'ja': 'JA' };
    const langEl = document.getElementById('current-lang-code');
    if (langEl) langEl.innerText = langCodes[lang] || lang.toUpperCase();

    if (currentUser && typeof renderSidebarMenus === 'function') renderSidebarMenus();
}

// 取得上方導覽列名稱
function getTopMenuName() {
    if (window.currentActiveTopMenuId === 'system_settings') return '系統設定';
    if (!window.currentActiveTopMenuId) return '';
    const menus = getCustomMenus();
    const cTargetId = window.cleanId(window.currentActiveTopMenuId);
    const topMenu = menus.find(m => window.cleanId(m.id) === cTargetId);
    if (topMenu) {
        let dName = topMenu.displayName;
        if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + topMenu.id] && !topMenu.isEdited) dName = i18n[currentLang]['dyn_' + topMenu.id];
        return dName;
    }
    return '';
}

// 取得麵包屑路徑
function getMenuPath(element) {
    let path = []; let current = element;
    while (current) {
        let container = current.closest('.collapse');
        if (!container) break;
        let targetId = container.id;
        let parentItem = document.querySelector(`[data-bs-target="#${targetId}"]`);
        if (parentItem) {
            let textSpan = parentItem.querySelector('span');
            if (textSpan) path.unshift(textSpan.innerText.trim());
            else path.unshift(parentItem.innerText.trim());
            current = parentItem;
        } else break;
    }
    return path.join(' / ');
}

// 取得完整路徑字串
function getFullMenuPathStr(menuId, allMenus) {
    let path = [];
    let cTargetId = window.cleanId(menuId);
    let curr = allMenus.find(m => window.cleanId(m.id) === cTargetId);
    while (curr) {
        let dName = curr.displayName;
        if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + curr.id] && !curr.isEdited) {
            dName = i18n[currentLang]['dyn_' + curr.id];
        }
        path.unshift(dName);

        let pId = curr.parentId || (curr.parentIds && curr.parentIds.length > 0 ? curr.parentIds[0] : null);
        let cPId = window.cleanId(pId);
        if (cPId && cPId !== 'null') {
            curr = allMenus.find(m => window.cleanId(m.id) === cPId);
        } else {
            curr = null;
        }
    }
    return path.join(' / ');
}

// 判斷是否為子節點
window.isMenuDescendant = function (folderId, targetId, allMenus) {
    let cFolderId = window.cleanId(folderId);
    let cTargetId = window.cleanId(targetId);
    if (cFolderId === cTargetId) return true;
    let queue = [cFolderId];
    while (queue.length > 0) {
        let curr = queue.shift();
        let children = allMenus.filter(m => window.cleanId(m.parentId) === curr || (m.parentIds || []).map(window.cleanId).includes(curr));
        for (let child of children) {
            let cId = window.cleanId(child.id);
            if (cId === cTargetId) return true;
            queue.push(cId);
        }
    }
    return false;
};

// ⭐️ 智慧點擊主選單連動：直接依照繪製好的側邊欄判斷是否為網頁
function selectTopMenu(menuId) {
    window.currentActiveTopMenuId = menuId;
    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

    if (menuId === 'system_settings') {
        setTimeout(() => {
            const firstLeafEl = document.querySelector('#dynamic-sidebar-menus .menu-item:not([data-bs-toggle="collapse"])');
            if (firstLeafEl) firstLeafEl.click();
        }, 50);
        return;
    }

    setTimeout(() => {
        // 直接檢查側邊欄是否有成功畫出任何項目 (代表有子選單)
        const hasSidebarItems = document.querySelectorAll('#dynamic-sidebar-menus .menu-item').length > 0;
        const firstLeafEl = document.querySelector('#dynamic-sidebar-menus .menu-item:not([data-bs-toggle="collapse"])');

        if (!hasSidebarItems) {
            // 側邊欄沒有東西，代表這是一個獨立的主選單網頁，直接執行開啟動作
            const menus = getCustomMenus();
            const activeRoot = menus.find(m => window.cleanId(m.id) === window.cleanId(menuId));
            if (activeRoot) {
                let dName = activeRoot.displayName;
                if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + activeRoot.id] && !activeRoot.isEdited) dName = i18n[currentLang]['dyn_' + activeRoot.id];

                if (activeRoot.menuMode === 'app_grid') openAppGridPage(activeRoot.id, dName, null);
                else if (activeRoot.url) {
                    if (activeRoot.target === 'blank') window.open(activeRoot.url, '_blank');
                    else if (activeRoot.target === 'fullscreen') openDynamicIframe(activeRoot.url, dName, null, true);
                    else openDynamicIframe(activeRoot.url, dName, null, false);
                }
                else if (activeRoot.targetPage) navTo(activeRoot.targetPage, null, dName);
                else {
                    let underConstructionPage = document.getElementById('page-under-construction');
                    const mainContent = document.getElementById('main-content');
                    if (!underConstructionPage) {
                        underConstructionPage = document.createElement('div');
                        underConstructionPage.id = 'page-under-construction';
                        underConstructionPage.className = 'page-section';
                        underConstructionPage.innerHTML = `<div class="manage-alert" id="under-construction-text"></div>`;
                        if (mainContent) mainContent.appendChild(underConstructionPage);
                    } else if (underConstructionPage.parentElement && underConstructionPage.parentElement.id !== 'main-content') {
                        if (mainContent) mainContent.appendChild(underConstructionPage);
                    }
                    const textEl = document.getElementById('under-construction-text');
                    if (textEl) textEl.innerText = `${dName} 內容建置中`;
                    navTo('page-under-construction', null, dName);
                }
            }
        } else if (firstLeafEl) {
            // 側邊欄有東西，代表這是一個群組，自動點擊群組內的第一個網頁
            firstLeafEl.click();
        }
    }, 50);
}

// 點擊啟動特定看板 (跨階層支援)
function activateMenu(menuId) {
    if (!menuId) return;
    const menus = getCustomMenus();
    const targetMenu = menus.find(m => window.cleanId(m.id) === window.cleanId(menuId));
    if (!targetMenu) return;

    let rootId = targetMenu.id;
    let currNode = targetMenu;
    while (currNode) {
        let pId = currNode.parentId || (currNode.parentIds && currNode.parentIds.length > 0 ? currNode.parentIds[0] : null);
        let cPId = window.cleanId(pId);
        if (cPId && cPId !== 'null') {
            currNode = menus.find(m => window.cleanId(m.id) === cPId);
            if (currNode) rootId = currNode.id;
            else break;
        } else {
            break;
        }
    }

    window.currentActiveTopMenuId = rootId;
    window.currentActiveSidebarMenuId = menuId;

    if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

    let dName = targetMenu.displayName;
    if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + targetMenu.id] && !targetMenu.isEdited) {
        dName = i18n[currentLang]['dyn_' + targetMenu.id];
    }

    const elList = document.querySelectorAll('.menu-item');
    let targetEl = null;
    elList.forEach(el => { if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(targetMenu.id)) targetEl = el; });

    if (targetMenu.menuMode === 'app_grid') openAppGridPage(targetMenu.id, dName, targetEl);
    else if (targetMenu.url) openDynamicIframe(targetMenu.url, dName, targetEl, targetMenu.target === 'fullscreen');
    else if (targetMenu.targetPage) {
        navTo(targetMenu.targetPage, targetEl, dName);
    } else {
        let underConstructionPage = document.getElementById('page-under-construction');
        const mainContent = document.getElementById('main-content');
        if (!underConstructionPage) {
            underConstructionPage = document.createElement('div');
            underConstructionPage.id = 'page-under-construction';
            underConstructionPage.className = 'page-section';
            underConstructionPage.innerHTML = `<div class="manage-alert" id="under-construction-text"></div>`;
            if (mainContent) mainContent.appendChild(underConstructionPage);
        } else if (underConstructionPage.parentElement && underConstructionPage.parentElement.id !== 'main-content') {
            if (mainContent) mainContent.appendChild(underConstructionPage);
        }
        const textEl = document.getElementById('under-construction-text');
        if (textEl) textEl.innerText = `${dName} 內容建置中`;
        navTo('page-under-construction', targetEl, dName);
    }
}

// 跳轉回預設首頁
function goDefaultHome() {
    if (!currentUser) return;

    let defPage = null;
    if (currentUser.defaultPages && currentUser.defaultPages[currentFab]) {
        defPage = currentUser.defaultPages[currentFab];
    } else if (currentUser.defaultPage) {
        defPage = currentUser.defaultPage;
    }

    if (!defPage) {
        const currentFabObj = getFabs().find(f => window.cleanId(f.fabName) === window.cleanId(currentFab) || window.cleanId(f.id) === window.cleanId(currentFab));
        if (currentFabObj) {
            const fabRoleIds = currentFabObj.assignedRoles || [];
            const userRoleIds = currentUser.assignedRoles || [];
            const activeRoleIds = (currentUser.roleLevel === 'admin') ? fabRoleIds : fabRoleIds.filter(id => userRoleIds.some(uid => window.cleanId(uid) === window.cleanId(id)));

            const roles = getRoles();
            let initialMenuIds = [];
            activeRoleIds.forEach(roleId => {
                const role = roles.find(r => window.cleanId(r.id) === window.cleanId(roleId));
                if (role && role.allowedMenuIds) initialMenuIds.push(...role.allowedMenuIds);
            });

            const menus = getCustomMenus();
            if (initialMenuIds.length > 0) {
                // 找出第一個可視清單
                defPage = initialMenuIds[0];
            }
        }
    }

    if (!defPage) defPage = 'm_ze_1';
    activateMenu(defPage);
}

// 導航到指定區域塊
function navTo(pageId, element, subTitle = '') {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');
    document.body.classList.remove('fullscreen-mode');

    if (pageId === 'page-iframe') {
        document.body.classList.add('iframe-mode');
    } else {
        document.body.classList.remove('iframe-mode');
    }

    const bcPath = document.getElementById('bc-path');
    const bcName = document.getElementById('bc-name');
    if (bcPath && bcName) {
        if (pageId === 'page-home') {
            bcPath.style.display = 'none';
            bcName.innerText = '首頁總覽';
        } else {
            let topName = getTopMenuName();
            let folderPath = element ? getMenuPath(element) : '';

            let finalPathArr = [];
            if (topName) finalPathArr.push(topName);
            if (folderPath) finalPathArr.push(folderPath);

            if (finalPathArr.length > 0) {
                bcPath.style.display = 'inline';
                bcPath.innerText = finalPathArr.join(' / ') + ' / ';
            } else {
                bcPath.style.display = 'none';
            }

            let elName = element ? (element.querySelector('span')?.innerText || element.innerText.trim()) : '';
            bcName.innerText = subTitle || elName || '';
        }
    }

    if (pageId === 'page-personal-manage' && typeof renderPersonalMenuManage === 'function') renderPersonalMenuManage();
    if (pageId === 'page-webpage-manage' && typeof renderWebpageTable === 'function') renderWebpageTable();
    if (pageId === 'page-menu-manage' && typeof renderMenuConfigTable === 'function') renderMenuConfigTable();
    if (pageId === 'page-fab-manage' && typeof renderFabTable === 'function') renderFabTable();
    if (pageId === 'page-role-manage' && typeof renderRoleTable === 'function') renderRoleTable();
    if (pageId === 'page-account-manage' && typeof renderAccountTable === 'function') renderAccountTable();
    if (pageId === 'page-apply' && typeof renderApplyTable === 'function') renderApplyTable();
    if (pageId === 'page-audit-manage' && typeof renderAuditTable === 'function') renderAuditTable();
    if (pageId !== 'page-app-grid') currentAppGridMenuId = null;
}

function openDynamicIframe(url, title, element, isFullscreen = false) {
    if (!url) return;
    navTo('page-iframe', element, title);
    const iframe = document.getElementById('main-iframe');
    iframe.removeAttribute('srcdoc');

    let finalUrl = url;
    if (!finalUrl.includes('fab=')) {
        finalUrl = finalUrl.includes('?') ? `${finalUrl}&fab=${currentFab}` : `${finalUrl}?fab=${currentFab}`;
    }
    if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('/') && !finalUrl.startsWith('page-')) {
        finalUrl = 'http://' + finalUrl;
    }
    iframe.src = finalUrl;
    if (isFullscreen) document.body.classList.add('fullscreen-mode');
    else document.body.classList.remove('fullscreen-mode');
}

// 產生 Icon 的 HTML (共用)
function generateIconHtml(iconVal, colorCls, extraCls, isFolder = false) {
    if (!iconVal) return `<i class="fas ${isFolder ? 'fa-folder text-warning' : 'fa-file-alt text-muted'} ${extraCls}"></i>`;
    if (iconVal.startsWith('data:image') || iconVal.startsWith('icon/')) return `<img src="${iconVal}" class="custom-icon ${extraCls}" alt="icon">`;
    return `<i class="${iconVal} ${colorCls} ${extraCls}"></i>`;
}

// 更新同步按鈕狀態 UI
function updateSyncButtonUI() {
    const btn = document.getElementById('btn-sync-excel');
    if (btn) {
        if (hasUnsavedChanges) { btn.classList.remove('d-none'); btn.classList.add('d-inline-flex'); }
        else { btn.classList.add('d-none'); btn.classList.remove('d-inline-flex'); }
    }
}

function customAlert(msg) {
    const msgEl = document.getElementById('systemAlertMsg');
    if (msgEl) {
        msgEl.innerHTML = (typeof msg === 'object' && msg !== null) ? (msg.message || JSON.stringify(msg)) : msg;
    }
    if (systemAlertModalObj) systemAlertModalObj.show();
}

function customConfirm(msg, callback) {
    const msgEl = document.getElementById('systemConfirmMsg');
    if (msgEl) {
        msgEl.innerHTML = (typeof msg === 'object' && msg !== null) ? (msg.message || JSON.stringify(msg)) : msg;
    }
    confirmActionCallback = callback;
    if (systemConfirmModalObj) systemConfirmModalObj.show();
}