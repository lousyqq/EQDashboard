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

// 全域釘選狀態（對齊 TEST：預設固定）
window.isPinned = (typeof window.isPinned === 'boolean') ? window.isPinned : true;

function togglePin() {
    window.isPinned = !window.isPinned;

    const btnPin = document.getElementById('btn-pin');

    if (window.isPinned) {
        // 固定模式：nav 一定顯示
        document.body.classList.remove('nav-hidden');

        // 只有「有子選單 / 系統設定」才展開 sidebar（對齊 TEST）
        let hasChildren = false;
        try {
            if (window.currentActiveTopMenuId === 'system_settings') {
                hasChildren = true;
            } else if (window.currentActiveTopMenuId && typeof getCustomMenus === 'function') {
                const cTargetId = window.cleanId(window.currentActiveTopMenuId);
                const menus = getCustomMenus() || [];
                const children = menus.filter(m =>
                    window.cleanId(m.parentId) === cTargetId ||
                    (m.parentIds || []).map(window.cleanId).includes(cTargetId)
                );
                if (children.length > 0) hasChildren = true;
            } else {
                hasChildren = true; // 無資料可判斷時保守展開
            }
        } catch (e) {
            hasChildren = true;
        }

        if (hasChildren) document.body.classList.remove('sidebar-hidden');
        else document.body.classList.add('sidebar-hidden');

        if (btnPin) {
            btnPin.classList.add('is-pinned');
            btnPin.innerHTML = '<i class="fa-solid fa-thumbtack text-danger" style="font-size: 0.9rem;"></i>';
            btnPin.style.background = 'transparent';
            btnPin.style.color = 'inherit';
        }
    } else {
        // 對齊舊版：取消釘選後不立即隱藏，等滑鼠移出 navbar/sidebar 才由 mouseleave 監聽器接手
        if (btnPin) {
            btnPin.classList.remove('is-pinned');
            btnPin.innerHTML = '<i class="fa-solid fa-unlock text-white-50" style="font-size: 0.9rem;"></i>';
            btnPin.style.background = 'transparent';
            btnPin.style.color = 'inherit';
        }
    }
}

// 讓 index.html 的 onclick="togglePin()" 一定能呼叫到
window.togglePin = togglePin;

// 切換全螢幕
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen-mode');
    if (document.body.classList.contains('fullscreen-mode')) {
        if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(err => console.log(err)); }
    } else {
        if (document.fullscreenElement) { document.exitFullscreen().catch(err => console.log(err)); }
    }
}

// ============================================================================
// ⭐️ 重構：安全、精準補獲側邊欄「個人頁面管理」按鈕 (絕不影響主畫面 Table 內容)
// ============================================================================
let enforceTimer = null;
function enforceSystemModeUI() {
    if (typeof currentLayoutMode === 'undefined') return;

    if (enforceTimer) clearTimeout(enforceTimer);
    enforceTimer = setTimeout(() => {
        // ⭐️ 精準且安全地尋找「個人頁面管理」按鈕，避開 querySelectorAll('*') 對主畫面表格的干擾
        const personalBtn = document.querySelector('[data-bs-target="#personalMenuModal"]');
        if (personalBtn) {
            // 尋找其外層包裝容器 (如 border-top 分隔線或是 sidebar-footer 底部區塊)
            const wrapper = personalBtn.closest('li, .nav-item, .sidebar-footer, .mt-auto, .border-top') || personalBtn;

            if (currentLayoutMode === 'system') {
                // 系統模式下：隱藏按鈕與其外層容器
                wrapper.style.setProperty('display', 'none', 'important');
            } else {
                // 自訂模式下：還原顯示狀態
                wrapper.style.removeProperty('display');
            }
        }
    }, 20); // 確保畫面渲染完成後再隱藏
}

// ⭐️ 核心修復：切換系統/自訂版面
// ===== 單一真實來源：切換系統/自訂版面（對齊 TEST_20260429.html，統一使用 'personal'）=====
function switchLayoutMode(mode) {
    // normalize to: system / personal （與 TEST_20260429.html:2147 currentLayoutMode='system' 一致）
    const m = String(mode ?? 'system').toLowerCase();
    const finalMode = (m.includes('custom') || m.includes('personal') || m.includes('自訂')) ? 'personal' : 'system';

    currentLayoutMode = finalMode;

    // 同步 slider UI
    const wrapper = document.getElementById('layout-toggle-wrapper');
    const sysText = document.getElementById('btn-layout-system');
    const perText = document.getElementById('btn-layout-personal');
    if (wrapper) {
        if (finalMode === 'system') {
            wrapper.classList.remove('personal-active');
            sysText?.classList.add('active');
            perText?.classList.remove('active');
        } else {
            wrapper.classList.add('personal-active');
            sysText?.classList.remove('active');
            perText?.classList.add('active');
        }
    }

    try {
        const isInSystemSettings = (window.currentActiveTopMenuId === 'system_settings');

        if (!isInSystemSettings) {
            window.currentActiveTopMenuId = null;
            window.currentActiveSidebarMenuId = null;
        }

        // 頂部頁籤已由 renderSidebarMenus 一併渲染，無需另外呼叫 renderTopMenus
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

        if (isInSystemSettings) {
            // 留在系統設定，不要踢回首頁
            const personalPage = document.getElementById('page-personal-manage');
            if (finalMode === 'system' && personalPage && personalPage.classList.contains('active')) {
                if (typeof navTo === 'function') {
                    if (typeof currentUser !== 'undefined' && currentUser?.roleLevel === 'admin') navTo('page-account-manage', null, '帳號管理');
                    else navTo('page-apply', null, '需求申請');
                }
            }
        } else {
            // 對齊 TEST：切換模式一律導回「預設首頁」，不顯示 page-home
            if (typeof goDefaultHome === 'function') goDefaultHome();
        }
    } catch (e) {
        console.error("🚨 切換模式錯誤:", e);
    }

    if (typeof enforceSystemModeUI === 'function') enforceSystemModeUI();
}

// 讓 index.html 的 onclick="switchLayoutMode(...)" 一定能呼叫到
window.switchLayoutMode = switchLayoutMode;

function changeLanguage(lang) {
    currentLang = lang;

    if (typeof i18n !== 'undefined') {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang] && i18n[lang][key]) el.innerHTML = i18n[lang][key];
        });
    }

    const langCodes = { 'zh': 'ZH', 'en': 'EN', 'ja': 'JA' };
    const langNames = { 'zh': '繁中', 'en': 'EN', 'ja': '日本語' };
    const langCodeEl = document.getElementById('current-lang-code');
    if (langCodeEl) langCodeEl.innerText = langCodes[lang] || lang.toUpperCase();
    const langDisplayEl = document.getElementById('current-lang-display');
    if (langDisplayEl) langDisplayEl.innerText = langNames[lang] || lang.toUpperCase();

    // ✅ 新增：重繪語言下拉，套用 active + 打勾
    renderLangSwitcher();

    // ✅ 對齊 TEST：有登入才重繪側邊欄
    if (currentUser) renderSidebarMenus();
}
window.changeLanguage = changeLanguage;


function renderLangSwitcher() {
    const container = document.getElementById('lang-dropdown-menu');
    if (!container) return;

    const langs = [
        { code: 'zh', label: '繁體中文' },
        { code: 'en', label: 'English' },
        { code: 'ja', label: '日本語' }
    ];

    container.innerHTML = langs.map(l => `
        <li>
            <a class="dropdown-item py-1 fw-bold cursor-pointer d-flex justify-content-between align-items-center
                ${currentLang === l.code ? 'active bg-light text-primary' : ''}"
               onclick="changeLanguage('${l.code}')">
                ${l.label}
                ${currentLang === l.code ? '<i class="fa-solid fa-check"></i>' : ''}
            </a>
        </li>
    `).join('');
}
window.renderLangSwitcher = renderLangSwitcher;

// 取得上方導覽列名稱
function getTopMenuName() {
    if (window.currentActiveTopMenuId === 'system_settings') return '系統設定';
    if (!window.currentActiveTopMenuId) return '';
    const menus = getCustomMenus();
    const cTargetId = window.cleanId(window.currentActiveTopMenuId);
    const topMenu = menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === cTargetId);
    if (topMenu) {
        let mId = topMenu.id || topMenu.MenuId || topMenu.menuId;
        let dName = topMenu.displayName || topMenu.DisplayName || topMenu.sysName || topMenu.SysName;
        let isEdited = topMenu.isEdited || topMenu.IsEdited;

        if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + mId] && !isEdited) {
            dName = i18n[currentLang]['dyn_' + mId];
        }
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
    let curr = allMenus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === cTargetId);

    while (curr) {
        let mId = curr.id || curr.MenuId || curr.menuId;
        let dName = curr.displayName || curr.DisplayName || curr.sysName || curr.SysName;
        let isEdited = curr.isEdited || curr.IsEdited;

        if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + mId] && !isEdited) {
            dName = i18n[currentLang]['dyn_' + mId];
        }
        path.unshift(dName);

        let pId = curr.parentId || curr.ParentMenuId || curr.parentMenuId || (curr.parentIds && curr.parentIds.length > 0 ? curr.parentIds[0] : null);
        let cPId = window.cleanId(pId);

        if (cPId && cPId !== 'null') {
            curr = allMenus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === cPId);
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
        let children = allMenus.filter(m => {
            let pId = m.parentId || m.ParentMenuId || m.parentMenuId;
            return window.cleanId(pId) === curr || (m.parentIds || []).map(window.cleanId).includes(curr);
        });
        for (let child of children) {
            let cId = window.cleanId(child.id || child.MenuId || child.menuId);
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
            const activeRoot = menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === window.cleanId(menuId));

            if (activeRoot) {
                let mId = activeRoot.id || activeRoot.MenuId || activeRoot.menuId;
                let dName = activeRoot.displayName || activeRoot.DisplayName || activeRoot.sysName || activeRoot.SysName;
                let mMode = activeRoot.menuMode || activeRoot.MenuMode;
                let mUrl = activeRoot.url || activeRoot.Url;
                let mTarget = activeRoot.target || activeRoot.Target || activeRoot.openTarget || activeRoot.OpenTarget;
                let mTargetPage = activeRoot.targetPage || activeRoot.TargetPage;
                let isEdited = activeRoot.isEdited || activeRoot.IsEdited;

                if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + mId] && !isEdited) {
                    dName = i18n[currentLang]['dyn_' + mId];
                }

                if (mMode === 'app_grid') openAppGridPage(mId, dName, null);
                else if (mUrl) {
                    if (mTarget === 'blank') window.open(mUrl, '_blank');
                    else if (mTarget === 'fullscreen') openDynamicIframe(mUrl, dName, null, true);
                    else openDynamicIframe(mUrl, dName, null, false);
                }
                else if (mTargetPage) navTo(mTargetPage, null, dName);
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

// ⭐️ 核心修復：點擊啟動特定看板 (加入對 DB 欄位大寫的全面支援)
function activateMenu(menuId) {
    try {
        if (!menuId) {
            // ⭐️ 徹底封殺 page-home 迴圈，不顯示多餘的總覽
            return;
        }

        const menus = getCustomMenus();
        const targetMenu = menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === window.cleanId(menuId));

        if (!targetMenu) {
            console.warn("🚨 無法在資料庫找到對應的選單 ID:", menuId);
            // ⭐️ 徹底封殺 page-home 迴圈
            return;
        }

        let rootId = targetMenu.id || targetMenu.MenuId || targetMenu.menuId;
        let currNode = targetMenu;
        while (currNode) {
            let pId = currNode.parentId || currNode.ParentMenuId || currNode.parentMenuId || (currNode.parentIds && currNode.parentIds.length > 0 ? currNode.parentIds[0] : null);
            let cPId = window.cleanId(pId);
            if (cPId && cPId !== 'null') {
                currNode = menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === cPId);
                if (currNode) rootId = currNode.id || currNode.MenuId || currNode.menuId;
                else break;
            } else {
                break;
            }
        }

        window.currentActiveTopMenuId = rootId;
        window.currentActiveSidebarMenuId = menuId;

        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

        let mId = targetMenu.id || targetMenu.MenuId || targetMenu.menuId;
        let dName = targetMenu.displayName || targetMenu.DisplayName || targetMenu.sysName || targetMenu.SysName;
        let mMode = targetMenu.menuMode || targetMenu.MenuMode;
        let mUrl = targetMenu.url || targetMenu.Url;
        let mTarget = targetMenu.target || targetMenu.Target || targetMenu.openTarget || targetMenu.OpenTarget;
        let mTargetPage = targetMenu.targetPage || targetMenu.TargetPage;
        let isEdited = targetMenu.isEdited || targetMenu.IsEdited;

        if (typeof i18n !== 'undefined' && i18n[currentLang] && i18n[currentLang]['dyn_' + mId] && !isEdited) {
            dName = i18n[currentLang]['dyn_' + mId];
        }

        const elList = document.querySelectorAll('.menu-item');
        let targetEl = null;
        elList.forEach(el => { if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(mId)) targetEl = el; });

        if (mMode === 'app_grid') openAppGridPage(mId, dName, targetEl);
        else if (mUrl) {
            // 依 OpenTarget 區分：blank=另開分頁 / fullscreen=全螢幕 / 其他=畫面內嵌
            if (mTarget === 'blank') {
                window.open(mUrl, '_blank');
            } else if (mTarget === 'fullscreen') {
                openDynamicIframe(mUrl, dName, targetEl, true);
            } else {
                openDynamicIframe(mUrl, dName, targetEl, false);
            }
        }
        else if (mTargetPage) {
            navTo(mTargetPage, targetEl, dName);
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
    } catch (error) {
        console.error("🚨 啟動看板時發生錯誤:", error);
    }
}

// ⭐️ 對齊 TEST_20260429.html:3496 的預設首頁跳轉（含廠區過濾、folder 自動取第一個子節點）
function goDefaultHome() {
    try {
        if (!currentUser) return;

        let defPage = null;

        // 1. 優先使用該帳號在目前廠區設定的專屬首頁
        if (currentUser.defaultPages && currentUser.defaultPages[currentFab]) {
            defPage = currentUser.defaultPages[currentFab];
        } else if (currentUser.defaultPage) {
            defPage = currentUser.defaultPage; // 向下相容舊資料
        }

        const menus = getCustomMenus() || [];

        // 2. 未設定 → 依目前廠區 fab.assignedRoles 與帳號 assignedRoles 的交集，找出該帳號可看的第一個 root
        if (!defPage) {
            const currentFabObj = getFabs().find(f => window.cleanId(f.fabName || f.FabName) === window.cleanId(currentFab));
            if (currentFabObj) {
                const fabRoleIds = currentFabObj.assignedRoles || currentFabObj.AssignedRoles || [];
                const userRoleIds = currentUser.assignedRoles || currentUser.AssignedRoles || [];
                const activeRoleIds = (currentUser.roleLevel === 'admin')
                    ? fabRoleIds
                    : fabRoleIds.filter(id => userRoleIds.some(uId => window.cleanId(uId) === window.cleanId(id)));

                const roles = getRoles();
                let initialMenuIds = [];
                activeRoleIds.forEach(roleId => {
                    const role = roles.find(r => window.cleanId(r.id || r.RoleId) === window.cleanId(roleId));
                    if (role && (role.allowedMenuIds || role.AllowedMenuIds)) {
                        initialMenuIds.push(...(role.allowedMenuIds || role.AllowedMenuIds));
                    }
                });

                const allowedIds = typeof window.getAllowedIdsWithHierarchy === 'function'
                    ? window.getAllowedIdsWithHierarchy(menus, initialMenuIds)
                    : new Set(initialMenuIds);

                // 找出第一層 root（非 pool、無父節點、啟用、且在 allowedIds 中）
                let validRoots = menus.filter(m =>
                    m.isPoolItem === false &&
                    !m.parentId &&
                    (!m.parentIds || m.parentIds.length === 0) &&
                    m.enabled !== false &&
                    allowedIds.has(m.id)
                );

                // 依群組權限指定的順序排序
                validRoots.sort((a, b) => {
                    let idxA = initialMenuIds.indexOf(a.id);
                    let idxB = initialMenuIds.indexOf(b.id);
                    return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
                });

                if (validRoots.length > 0) {
                    let firstRoot = validRoots[0];
                    // root 若為 folder，自動取其下第一個子看板，避免顯示空殼
                    if (firstRoot.menuMode === 'folder') {
                        let children = menus.filter(m =>
                            m.parentId === firstRoot.id ||
                            (m.parentIds && m.parentIds.includes(firstRoot.id))
                        );
                        children.sort((a, b) =>
                            (a.parentOrders && a.parentOrders[firstRoot.id] != null ? a.parentOrders[firstRoot.id] : (a.order || 0)) -
                            (b.parentOrders && b.parentOrders[firstRoot.id] != null ? b.parentOrders[firstRoot.id] : (b.order || 0))
                        );
                        defPage = children.length > 0 ? children[0].id : firstRoot.id;
                    } else {
                        defPage = firstRoot.id;
                    }
                }
            }
        }

        // 3. 終極防呆：仍找不到 → 第一個非資料夾的看板
        if (!defPage || !menus.find(m => window.cleanId(m.id) === window.cleanId(defPage))) {
            let firstVisible = menus.find(m => (m.menuMode || '').toLowerCase() !== 'folder');
            if (firstVisible) defPage = firstVisible.id;
            else if (menus.length > 0) defPage = menus[0].id;
        }

        if (defPage) activateMenu(defPage);
    } catch (error) {
        console.error("🚨 導向預設首頁時發生錯誤:", error);
    }
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

// === Alert 防重複 / 匯入訊息控管 ===
window.__alertState = window.__alertState || {
    lastHtml: null,
    lastAt: 0
};

// 預設：不讓「匯入結果」在每次一般儲存時一直彈出
window.__allowImportResultAlert = window.__allowImportResultAlert || false;

// 提供一個工具：只允許接下來 1 次匯入結果訊息彈出
window.allowNextImportResultAlert = function () {
    window.__allowImportResultAlert = true;
    // 10 秒後自動關掉，避免忘記關
    setTimeout(() => { window.__allowImportResultAlert = false; }, 10000);
};


function customAlert(msg) {
    const msgEl = document.getElementById('systemAlertMsg');

    // 轉成 HTML 字串
    const html = (typeof msg === 'object' && msg !== null)
        ? (msg.message || JSON.stringify(msg))
        : String(msg ?? '');

    // 1) 若是「匯入結果」訊息：預設不彈，避免你每次編輯/儲存都一直跳
    const isImportResult =
        html.includes('匯入完畢') ||
        html.includes('成功同步至資料庫') ||
        html.includes('略過異常') ||
        html.includes('全部資料');

    if (isImportResult && window.__allowImportResultAlert !== true) {
        // 直接忽略
        return;
    }

    // 2) 防止同一訊息短時間內重複彈出
    const now = Date.now();
    if (window.__alertState.lastHtml === html && (now - window.__alertState.lastAt) < 1500) {
        return;
    }
    window.__alertState.lastHtml = html;
    window.__alertState.lastAt = now;

    if (msgEl) msgEl.innerHTML = html;
    if (typeof systemAlertModalObj !== 'undefined' && systemAlertModalObj) systemAlertModalObj.show();

    // 匯入結果只允許彈一次就關掉
    if (isImportResult) window.__allowImportResultAlert = false;
}

function customConfirm(msg, callback) {
    const msgEl = document.getElementById('systemConfirmMsg');
    if (msgEl) {
        msgEl.innerHTML = (typeof msg === 'object' && msg !== null) ? (msg.message || JSON.stringify(msg)) : msg;
    }
    confirmActionCallback = callback;
    if (systemConfirmModalObj) systemConfirmModalObj.show();
}

// 4. 綁定 MutationObserver 監視器
// 限縮在 #dynamic-sidebar-menus，避免在 DataTable/Modal 渲染時被全域觸發造成效能瓶頸
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const target = document.getElementById('dynamic-sidebar-menus');
        if (!target) return;
        const observer = new MutationObserver(() => {
            requestAnimationFrame(() => enforceSystemModeUI());
        });
        observer.observe(target, { childList: true, subtree: true });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ✅ 初始化：先渲染語言下拉（active + 打勾）
    if (typeof renderLangSwitcher === 'function') renderLangSwitcher();
    // ✅ 初始化：同步釘選圖示（避免 icon 空白）
    if (typeof syncPinButtonUI === 'function') syncPinButtonUI();
    const contentZone = document.getElementById('main-content');
    const triggerTop = document.getElementById('trigger-top');
    const triggerLeft = document.getElementById('trigger-left');
    const topNavbar = document.getElementById('top-navbar');
    const sidebar = document.getElementById('sidebar');

    if (contentZone) {
        contentZone.addEventListener('mouseenter', () => {
            if (!window.isPinned) document.body.classList.add('nav-hidden', 'sidebar-hidden');
        });
    }

    if (topNavbar) {
        topNavbar.addEventListener('mouseleave', () => {
            if (!window.isPinned) document.body.classList.add('nav-hidden');
        });
    }

    if (sidebar) {
        sidebar.addEventListener('mouseleave', () => {
            if (!window.isPinned) document.body.classList.add('sidebar-hidden');
        });
    }

    if (triggerTop) {
        triggerTop.addEventListener('mouseenter', () => {
            if (!window.isPinned) document.body.classList.remove('nav-hidden');
        });
    }

    if (triggerLeft) {
        triggerLeft.addEventListener('mouseenter', () => {
            if (!window.isPinned) document.body.classList.remove('sidebar-hidden');
        });
    }
});


function syncPinButtonUI() {
    const btnPin = document.getElementById('btn-pin');
    if (!btnPin) return;

    const pinned = (typeof isPinned !== 'undefined') ? isPinned : (window.isPinned ?? true);

    btnPin.innerHTML = pinned
        ? '<i class="fa-solid fa-thumbtack text-danger" style="font-size: 0.9rem;"></i>'
        : '<i class="fa-solid fa-unlock text-white-50" style="font-size: 0.9rem;"></i>';
}

// =========================================================================
// ⭐️ 新增：語言切換 Dropdown UI 更新與聯動邏輯
// =========================================================================
window.updateLangUI = function (langCode, langName) {
    // 1. 更新頂部按鈕的顯示文字
    const display = document.getElementById('current-lang-display');
    if (display) display.innerText = langName;

    // 2. 切換下拉選單裡面的打勾 (Check) 圖示狀態
    document.querySelectorAll('.lang-check').forEach(el => el.classList.add('d-none'));
    const checkIcon = document.getElementById('check-' + langCode);
    if (checkIcon) checkIcon.classList.remove('d-none');

    // 3. 呼叫系統原有的語言切換核心函式 (觸發網頁翻譯與重繪)
    if (typeof changeLanguage === 'function') {
        changeLanguage(langCode);
    }

    // 4. 自動滑順收合 Bootstrap 下拉選單
    const dropdownBtn = document.getElementById('langDropdown');
    if (dropdownBtn && typeof bootstrap !== 'undefined') {
        const bsDropdown = bootstrap.Dropdown.getInstance(dropdownBtn) || new bootstrap.Dropdown(dropdownBtn);
        if (bsDropdown) bsDropdown.hide();
    }
};