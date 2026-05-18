<<<<<<< HEAD
﻿// ⭐️ 核心修復：切換系統/自訂版面 (保留系統設定狀態，即時切換側邊欄與按鈕效果)
window.switchLayoutMode = function (mode) {
    let finalMode = 'system';

    // 1. 正確解析點擊來源的模式
    if (typeof mode === 'string') {
        finalMode = (mode.toLowerCase().includes('custom') || mode.includes('自訂') || mode.includes('personal')) ? 'custom' : 'system';
    } else {
        const cusRadio = document.getElementById('btn-custom-mode');
        if (cusRadio && cusRadio.checked) finalMode = 'custom';
    }

    currentLayoutMode = finalMode;
    console.log("切換模式至:", finalMode);

    // 2. ⭐️ 同步 Bootstrap 原生 Radio 狀態 (僅改變 checked 屬性，讓 CSS 瞬間套用色彩)
    const sysRadio = document.getElementById('btn-system-mode');
    const cusRadio = document.getElementById('btn-custom-mode');
    if (sysRadio && sysRadio.tagName === 'INPUT') sysRadio.checked = (finalMode === 'system');
    if (cusRadio && cusRadio.tagName === 'INPUT') cusRadio.checked = (finalMode === 'custom');

    // (兼顧若您未來改用 Slider 滑動開關的備用相容邏輯)
    const wrapper = document.getElementById('layout-toggle-wrapper');
    const sysText = document.getElementById('btn-layout-system');
    const perText = document.getElementById('btn-layout-personal');
    if (wrapper) {
        if (finalMode === 'system') {
            wrapper.classList.remove('personal-active');
            if (sysText) sysText.classList.add('active');
            if (perText) perText.classList.remove('active');
        } else {
            wrapper.classList.add('personal-active');
            if (sysText) sysText.classList.remove('active');
            if (perText) perText.classList.add('active');
        }
    }

    // 3. 執行資料與畫面跳轉
    try {
        // ⭐️ 核心修復：判斷目前是否正在「系統設定」裡面
        const isCurrentlyInSystemSettings = (window.currentActiveTopMenuId === 'system_settings');

        if (!isCurrentlyInSystemSettings) {
            // 不在系統設定內，才需要清空選單記憶
            window.currentActiveTopMenuId = null;
            window.currentActiveSidebarMenuId = null;
        }

        // 確保側邊欄能即時重繪 (側邊欄會因為這裡的重繪瞬間生出或隱藏「個人頁面管理」)
        if (typeof renderTopMenus === 'function') renderTopMenus();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

        if (isCurrentlyInSystemSettings) {
            // 如果在系統設定內切換：留在原地，不要踢回首頁！
            // 特殊防呆：若目前正停在「個人頁面管理」卻切回「系統模式」，需將畫面踢回帳號管理以免畫面空白卡死
            const personalPage = document.getElementById('page-personal-manage');
            if (finalMode === 'system' && personalPage && personalPage.classList.contains('active')) {
                if (typeof navTo === 'function') {
                    if (typeof currentUser !== 'undefined' && currentUser.roleLevel === 'admin') navTo('page-account-manage', null, '帳號管理');
                    else navTo('page-apply', null, '需求申請');
                }
            }
        } else {
            // ⭐️ 徹底封殺 page-home 首頁總覽！無論切換到什麼模式，一律強迫直接導向使用者設定的預設首頁
            if (typeof goDefaultHome === 'function') goDefaultHome();
        }
    } catch (error) {
        console.error("🚨 畫面切換過程中發生非預期錯誤:", error);
    }

    // 4. 強制執行 UI 隱藏保護機制
    if (typeof enforceSystemModeUI === 'function') enforceSystemModeUI();
=======
// ====== UI 交互與畫面控制邏輯 ======

// ⭐️ 終極 ID 洗淨器：強行脫去所有括號、引號、空白與大小寫差異
window.cleanId = function (id) {
    if (id == null) return '';
    // 加入 \s 徹底去除所有的全形/半形空白與換行字元，完美防禦 Excel 輸入誤差！
    let s = String(id).replace(/[\s\[\]"']/g, '').toLowerCase();
    return s === 'null' ? '' : s;
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
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
function switchLayoutMode(mode) {
    // 1. 防呆：萬一傳入的是 Event 點擊事件，自動解析出是 system 還是 custom
    if (typeof mode !== 'string') {
        let el = (mode && (mode.currentTarget || mode.target));
        if (el) {
            let searchStr = (el.outerHTML || '') + (el.textContent || '') + (el.value || '');
            let forAttr = el.getAttribute('for') || '';
            if (searchStr.toLowerCase().includes('custom') || searchStr.includes('自訂') || forAttr.includes('custom')) {
                mode = 'custom';
            } else {
                mode = 'system';
            }
        } else {
            mode = 'system';
        }
    }

    currentLayoutMode = mode;
    console.log("切換版面模式為:", mode);

    // 2. ⭐️ 核心同步：僅設定 Radio 的 checked 狀態，切勿手動用 JS 暴悍修改 label 顏色！
    // 讓 index.html 內建的 Bootstrap .btn-check:checked + .btn-layout-mode-lbl 原生 CSS 機制自然且流暢地套用！
    const sysRadio = document.getElementById('btn-system-mode');
    const cusRadio = document.getElementById('btn-custom-mode');
    if (sysRadio && sysRadio.tagName === 'INPUT') sysRadio.checked = (mode === 'system');
    if (cusRadio && cusRadio.tagName === 'INPUT') cusRadio.checked = (mode === 'custom');

    try {
        // 3. 重新渲染導覽列與側邊欄 (這會根據自訂/系統模式決定要載入哪一種選單結構)
        if (typeof renderTopMenus === 'function') renderTopMenus();
        if (typeof renderSidebarMenus === 'function') renderSidebarMenus();

        // 4. ⭐️ 核心：無論切換到哪種模式，都自動導向該模式下的「預設首頁」，絕不出現空白的「首頁總覽」
        if (typeof goDefaultHome === 'function') {
            goDefaultHome();
        }
    } catch (error) {
        console.error("🚨 畫面切換過程中發生非預期錯誤:", error);
    }

    // 5. 呼叫檢查與隱藏邏輯 (控制個人頁面管理按鈕的顯示隱藏)
    enforceSystemModeUI();
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
        else if (mUrl) openDynamicIframe(mUrl, dName, targetEl, mTarget === 'fullscreen');
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

// ⭐️ 核心修復：跳轉回預設首頁 (確保資料庫找不到時不會卡死)
function goDefaultHome() {
    try {
        if (!currentUser) return;

        let defPage = null;
        if (currentUser.defaultPages && currentUser.defaultPages[currentFab]) {
            defPage = currentUser.defaultPages[currentFab];
        } else if (currentUser.defaultPage) {
            defPage = currentUser.defaultPage;
        }

        const menus = getCustomMenus() || [];

        // 如果沒有個人設定預設首頁，依照登入者的群組找尋第一個開放選單
        if (!defPage || !menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === window.cleanId(defPage))) {
            let activeRoleIds = currentUser.assignedRoles || currentUser.AssignedRoles || [];
            const roles = getRoles() || [];
            let initialMenuIds = [];

            activeRoleIds.forEach(roleId => {
                const role = roles.find(r => window.cleanId(r.id || r.RoleId || r.roleId) === window.cleanId(roleId));
                if (role) {
                    const roleMenus = role.menus || role.Menus || role.allowedMenuIds || [];
                    initialMenuIds.push(...roleMenus);
                }
            });

            for (let id of initialMenuIds) {
                if (menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === window.cleanId(id))) {
                    defPage = id;
                    break;
                }
            }
        }

        // 防呆：如果還是沒找到，挑選第一個非資料夾的系統看板顯示
        if (!defPage || !menus.find(m => window.cleanId(m.id || m.MenuId || m.menuId) === window.cleanId(defPage))) {
            let firstVisible = menus.find(m => (m.menuMode || m.MenuMode || '').toLowerCase() !== 'folder');
            if (firstVisible) {
                defPage = firstVisible.id || firstVisible.MenuId || firstVisible.menuId;
            } else if (menus.length > 0) {
                defPage = menus[0].id || menus[0].MenuId || menus[0].menuId;
            }
        }

        if (defPage) {
            activateMenu(defPage);
        }
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
<<<<<<< HEAD

// 4. 綁定 MutationObserver 監視器
// 攔截 render.js 的動態渲染：只要 HTML 結構有新增節點，就立刻觸發檢查
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const observer = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            for (let m of mutations) {
                if (m.addedNodes.length > 0) {
                    hasNewNodes = true;
                    break;
                }
            }
            if (hasNewNodes) {
                // 利用 requestAnimationFrame 確保畫面已經真正被畫出來
                requestAnimationFrame(() => {
                    enforceSystemModeUI();
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}
=======
>>>>>>> 777b3b462cbbe13da2f6a4f1fd610ddeac046cf1
