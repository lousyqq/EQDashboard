function doLogin() {
    const empId = document.getElementById('empId').value.trim().toLowerCase();
    let acc = null;

    try {
        acc = getAccounts().find(a => a.empId.toLowerCase() === empId);
    } catch (e) {
        console.error("讀取帳號失敗:", e);
    }

    // 🟢 【臨時緊急通道】：若資料庫目前無帳號資料，允許 admin 強制登入以進行 Excel 匯入
    if (!acc && empId === 'admin') {
        console.log("資料庫為空，啟用臨時 admin 登入通道");
        acc = {
            empId: 'admin', name: '系統管理員(臨時)', department: '系統救援',
            roleLevel: 'admin', assignedRoles: [], manageableMenus: [],
            canEditOthers: true, defaultPages: {}
        };
    }

    if (acc) {
        let statsStr = localStorage.getItem('umc_user_stats_' + acc.empId);
        let stats = statsStr ? JSON.parse(statsStr) : { count: 0, lastLogin: null };

        let now = new Date(); let pad = (n) => n < 10 ? '0' + n : n;
        let nowStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        let hours = now.getHours() % 12 || 12;
        let currentLoginTimeStr = pad(hours) + ':' + pad(now.getMinutes()) + (now.getHours() >= 12 ? ' PM' : ' AM');

        stats.count += 1;
        localStorage.setItem('umc_user_stats_' + acc.empId, JSON.stringify(stats));

        currentUser = {
            lastLoginDisplay: stats.lastLogin || nowStr,  // ⭐ 確認此行存在
            id: acc.empId, name: acc.name, department: acc.department || '', roleLevel: acc.roleLevel || 'user',
            assignedRoles: acc.assignedRoles || [], manageableMenus: acc.manageableMenus || [],
            canEditOthers: acc.canEditOthers || false, loginCount: stats.count,
            currentLoginTime: currentLoginTimeStr, defaultPages: acc.defaultPages || {}
        };
        localStorage.setItem('umc_current_user', JSON.stringify(currentUser));

        // ⭐️ 登入成功，直接隱藏登入框 (與原版行為一致)
        document.getElementById('login-overlay').style.display = 'none';

        if (typeof initDashboardUI === 'function') initDashboardUI();
    } else {
        if (typeof customAlert === 'function') {
            customAlert("找不到此帳號！請確認工號是否正確。");
        } else {
            alert("找不到此帳號！請確認工號是否正確。");
        }
    }
}

function logout() {
    localStorage.removeItem('umc_current_user');
    currentUser = null;

    // ⭐️ 登出時，直接顯示登入框遮罩，維持原版功能與畫面，絕不跑版
    document.getElementById('login-overlay').style.display = 'flex';
}