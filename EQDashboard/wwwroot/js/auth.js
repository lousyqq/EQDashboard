async function doLogin() {
    const empId = document.getElementById('empId').value.trim().toLowerCase();
    let acc = null;

    try {
        acc = getAccounts().find(a => String(a.empId || a.EmpId || '').toLowerCase() === empId);
    } catch (e) {
        console.error("讀取帳號失敗:", e);
    }

    // 🟢 【臨時緊急通道】：若資料庫目前無帳號資料，允許 admin 強制登入以進行 Excel 匯入
    if (!acc && empId === 'admin') {
        acc = {
            empId: 'admin', name: '系統管理員(臨時)', department: '系統救援',
            roleLevel: 'admin', assignedRoles: [], manageableMenus: [],
            canEditOthers: true, defaultPages: {}
        };
    }

    if (!acc) {
        if (typeof customAlert === 'function') customAlert("找不到此帳號！請確認工號是否正確。");
        else alert("找不到此帳號！請確認工號是否正確。");
        return;
    }

    const accEmpId = acc.empId || acc.EmpId || '';
    const pad = (n) => n < 10 ? '0' + n : n;
    const now = new Date();
    let displayLoginCount = (acc.loginCount || acc.LoginCount || 0) + 1;
    let displayLoginTime = formatLoginTime(now);

    // 1) 呼叫後端 /Settings/UpdateLoginStats 更新 DB 的 LoginCount / LastLoginTime
    try {
        const resp = await fetch('/Settings/UpdateLoginStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empId: accEmpId })
        });
        const result = await resp.json();
        if (result && result.success) {
            if (typeof result.loginCount === 'number') displayLoginCount = result.loginCount;
            if (result.lastLoginTime) displayLoginTime = formatLoginTimeFromDb(result.lastLoginTime);

            // 同步回 appState 與 LocalStorage，後續畫面顯示一致
            if (window.appState && window.appState.accounts) {
                const a = window.appState.accounts.find(x => String(x.empId).toLowerCase() === accEmpId.toLowerCase());
                if (a) { a.loginCount = displayLoginCount; a.lastLoginTime = result.lastLoginTime; }
            }
        }
    } catch (e) {
        // 後端不可用時走 LocalStorage 備援，畫面仍可顯示
        console.warn('UpdateLoginStats 失敗，使用 LocalStorage 備援:', e);
        const statsStr = localStorage.getItem('umc_user_stats_' + accEmpId);
        const stats = statsStr ? JSON.parse(statsStr) : { count: 0 };
        stats.count = (stats.count || 0) + 1;
        localStorage.setItem('umc_user_stats_' + accEmpId, JSON.stringify(stats));
        displayLoginCount = stats.count;
    }

    currentUser = {
        id: accEmpId,
        empId: accEmpId,
        name: acc.name || acc.Name || '',
        department: acc.department || acc.Department || '',
        roleLevel: acc.roleLevel || acc.RoleLevel || 'user',
        assignedRoles: acc.assignedRoles || acc.AssignedRoles || [],
        manageableMenus: acc.manageableMenus || acc.ManageableMenus || [],
        canEditOthers: acc.canEditOthers || acc.CanEditOthers || false,
        loginCount: displayLoginCount,
        currentLoginTime: displayLoginTime,
        defaultPages: acc.defaultPages || acc.DefaultPages || {}
    };
    localStorage.setItem('umc_current_user', JSON.stringify(currentUser));

    document.getElementById('login-overlay').style.display = 'none';
    if (typeof initDashboardUI === 'function') initDashboardUI();
}

// 12 小時制顯示：02:35 PM
function formatLoginTime(d) {
    const pad = (n) => n < 10 ? '0' + n : n;
    const h12 = d.getHours() % 12 || 12;
    const ampm = d.getHours() >= 12 ? ' PM' : ' AM';
    return pad(h12) + ':' + pad(d.getMinutes()) + ampm;
}

// DB 回傳 "yyyy-MM-dd HH:mm:ss" → 02:35 PM
function formatLoginTimeFromDb(dbStr) {
    try {
        const d = new Date(dbStr.replace(' ', 'T'));
        if (!isNaN(d.getTime())) return formatLoginTime(d);
    } catch (e) { }
    return dbStr;
}

function logout() {
    localStorage.removeItem('umc_current_user');
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
}
