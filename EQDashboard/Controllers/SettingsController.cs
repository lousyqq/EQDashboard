using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace EQDashboard.Controllers
{
    public class SettingsController : Controller
    {
        // 從 appsettings.json 的 ConnectionStrings:EQDashboard 取得連線字串
        private readonly string connStr;

        public SettingsController(IConfiguration config)
        {
            connStr = config.GetConnectionString("EQDashboard")
                ?? "Data Source=Sariel;Initial Catalog=EQDashboard;User ID=testuser;Password=test;TrustServerCertificate=True;";
        }

        private readonly string[] tableNames = new string[]
        {
            "Menus", "Fabs", "Roles", "Accounts", "Apps", "Requests",
            "Map_Fab_Role", "Map_Account_Role", "Map_Account_ManageMenu",
            "Map_Role_Menu", "Map_Menu_Structure", "Map_Account_DefaultPage", "PersonalSettings"
        };

        [HttpGet]
        public JsonResult GetInitialData()
        {
            var dbData = new Dictionary<string, object>();

            try
            {
                using (SqlConnection conn = new SqlConnection(connStr))
                {
                    conn.Open();
                    foreach (var tableName in tableNames)
                    {
                        var tableData = new List<Dictionary<string, object>>();

                        try
                        {
                            // ⭐️ 終極防護 1：讀取前先確認資料表是否存在，若不存在(如 Requests)則直接跳過，不報錯
                            using (SqlCommand checkCmd = new SqlCommand("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tb", conn))
                            {
                                checkCmd.Parameters.AddWithValue("@tb", tableName);
                                if ((int)checkCmd.ExecuteScalar() == 0) continue;
                            }

                            string query = $"SELECT * FROM [{tableName}]";

                            using (SqlCommand cmd = new SqlCommand(query, conn))
                            using (SqlDataReader reader = cmd.ExecuteReader())
                            {
                                while (reader.Read())
                                {
                                    var row = new Dictionary<string, object>();
                                    for (int i = 0; i < reader.FieldCount; i++)
                                    {
                                        row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                                    }
                                    tableData.Add(row);
                                }
                            }
                            dbData[tableName] = tableData;
                        }
                        catch (Exception tblEx)
                        {
                            Console.WriteLine($"警告: 讀取資料表 {tableName} 失敗 - {tblEx.Message}");
                        }
                    }
                }
                return Json(dbData);
            }
            catch (Exception ex)
            {
                return Json(new { error = true, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<JsonResult> SaveData()
        {
            try
            {
                using (StreamReader reader = new StreamReader(Request.Body))
                {
                    string json = await reader.ReadToEndAsync();
                    var payload = JsonSerializer.Deserialize<Dictionary<string, List<Dictionary<string, JsonElement>>>>(json);

                    int successCount = 0;
                    List<string> errorLogs = new List<string>();

                    using (SqlConnection conn = new SqlConnection(connStr))
                    {
                        conn.Open();
                        using (SqlTransaction trans = conn.BeginTransaction())
                        {
                            foreach (var tableName in tableNames)
                            {
                                if (payload.ContainsKey(tableName) && payload[tableName] != null)
                                {
                                    var tableData = payload[tableName];

                                    // ⭐️ 智慧判斷 1：先檢查工作表內是否有「真實有效」的資料
                                    bool hasAnyValidData = false;
                                    foreach (var row in tableData)
                                    {
                                        if (row == null || row.Count == 0) continue; // 沒有欄位

                                        foreach (var prop in row)
                                        {
                                            // 只要找到任何一個非 Null、非空字串的欄位，就視為有資料
                                            if (prop.Value.ValueKind != JsonValueKind.Null &&
                                                prop.Value.ValueKind != JsonValueKind.Undefined &&
                                                !string.IsNullOrWhiteSpace(prop.Value.ToString()))
                                            {
                                                hasAnyValidData = true;
                                                break;
                                            }
                                        }
                                        if (hasAnyValidData) break;
                                    }

                                    // 如果工作表內「沒有欄位」或是「只有標題但全是空值」，直接略過！(不刪除舊資料，也不寫入)
                                    if (!hasAnyValidData) continue;

                                    // ⭐️ 智慧判斷 2：寫入前確認資料表是否存在於資料庫，不存在的表直接略過
                                    using (SqlCommand checkCmd = new SqlCommand("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tb", conn, trans))
                                    {
                                        checkCmd.Parameters.AddWithValue("@tb", tableName);
                                        if ((int)checkCmd.ExecuteScalar() == 0) continue;
                                    }

                                    // ⭐️ M17 寫入防呆：比對「舊筆數」vs「新筆數」，若 new < 0.2 * old 且 old >= 5 拒絕覆寫
                                    int oldCount = 0;
                                    try
                                    {
                                        using (SqlCommand countCmd = new SqlCommand($"SELECT COUNT(*) FROM [{tableName}]", conn, trans))
                                        {
                                            oldCount = Convert.ToInt32(countCmd.ExecuteScalar());
                                        }
                                    }
                                    catch { /* 取得舊筆數失敗時，視為 0，不做防呆 */ }

                                    int newCount = tableData.Count(row => row != null && row.Any(p =>
                                        p.Value.ValueKind != JsonValueKind.Null &&
                                        p.Value.ValueKind != JsonValueKind.Undefined &&
                                        !string.IsNullOrWhiteSpace(p.Value.ToString())));

                                    if (oldCount >= 5 && newCount < oldCount * 0.2)
                                    {
                                        errorLogs.Add($"[{tableName}] 拒絕覆寫：原 {oldCount} 筆，新資料僅 {newCount} 筆（縮減超過 80%），疑似前端 payload 異常，本表略過。");
                                        continue;
                                    }

                                    // 1. 確定表存在，且有新資料要匯入時，才清空舊資料
                                    using (SqlCommand cmd = new SqlCommand($"DELETE FROM [{tableName}]", conn, trans))
                                    {
                                        cmd.ExecuteNonQuery();
                                    }

                                    // 2. 獲取 Schema 資訊作防呆
                                    var columnMaxLengths = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                                    var columnTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                                    bool hasIdentity = false;

                                    try
                                    {
                                        using (SqlCommand idCmd = new SqlCommand($"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('[{tableName}]') AND is_identity = 1", conn, trans))
                                        {
                                            hasIdentity = (int)idCmd.ExecuteScalar() > 0;
                                        }

                                        string schemaQuery = "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tb";
                                        using (SqlCommand schemaCmd = new SqlCommand(schemaQuery, conn, trans))
                                        {
                                            schemaCmd.Parameters.AddWithValue("@tb", tableName);
                                            using (SqlDataReader schemaReader = schemaCmd.ExecuteReader())
                                            {
                                                while (schemaReader.Read())
                                                {
                                                    string colName = schemaReader.GetString(0);
                                                    string dataType = schemaReader.GetString(1).ToLower();

                                                    int maxLen = 0;
                                                    if (!schemaReader.IsDBNull(2))
                                                    {
                                                        var lenObj = schemaReader.GetValue(2);
                                                        if (lenObj != null && lenObj != DBNull.Value) maxLen = Convert.ToInt32(lenObj);
                                                    }

                                                    columnMaxLengths[colName] = maxLen;
                                                    columnTypes[colName] = dataType;
                                                }
                                            }
                                        }
                                    }
                                    catch { /* 忽略 Schema 讀取錯誤 */ }

                                    if (hasIdentity)
                                    {
                                        try { using (SqlCommand cmdOn = new SqlCommand($"SET IDENTITY_INSERT [{tableName}] ON", conn, trans)) { cmdOn.ExecuteNonQuery(); } } catch { }
                                    }

                                    try
                                    {
                                        foreach (var row in tableData)
                                        {
                                            // 檢查單筆資料是否為空列 (Excel 的幽靈空白列)
                                            bool hasActualRowData = false;
                                            foreach (var prop in row)
                                            {
                                                if (prop.Value.ValueKind != JsonValueKind.Null &&
                                                    prop.Value.ValueKind != JsonValueKind.Undefined &&
                                                    !string.IsNullOrWhiteSpace(prop.Value.ToString()))
                                                {
                                                    hasActualRowData = true;
                                                    break;
                                                }
                                            }
                                            if (!hasActualRowData) continue;

                                            var validColumns = new List<string>();
                                            var validParams = new List<string>();
                                            string rowIdentifier = "未知";
                                            bool idCaptured = false;

                                            using (SqlCommand insertCmd = new SqlCommand())
                                            {
                                                insertCmd.Connection = conn;
                                                insertCmd.Transaction = trans;
                                                int pIndex = 0;

                                                try
                                                {
                                                    foreach (var prop in row)
                                                    {
                                                        string colName = prop.Key;

                                                        // 抓取第一筆有效資料當作報錯時的辨識 ID
                                                        if (!idCaptured && prop.Value.ValueKind != JsonValueKind.Null && prop.Value.ValueKind != JsonValueKind.Undefined)
                                                        {
                                                            string tempStr = prop.Value.ToString();
                                                            if (!string.IsNullOrWhiteSpace(tempStr))
                                                            {
                                                                rowIdentifier = tempStr;
                                                                idCaptured = true;
                                                            }
                                                        }

                                                        // 若資料庫內沒有對應的欄位則略過
                                                        if (columnTypes.Count > 0 && !columnTypes.ContainsKey(colName)) continue;

                                                        JsonElement val = prop.Value;
                                                        bool isNull = true;
                                                        object paramValue = null;

                                                        if (val.ValueKind != JsonValueKind.Null && val.ValueKind != JsonValueKind.Undefined)
                                                        {
                                                            string strVal = val.ToString();
                                                            if (!string.IsNullOrEmpty(strVal))
                                                            {
                                                                isNull = false;

                                                                if (columnTypes.ContainsKey(colName))
                                                                {
                                                                    string dbType = columnTypes[colName];

                                                                    if (dbType.Contains("char") || dbType.Contains("text"))
                                                                    {
                                                                        int maxLen = columnMaxLengths[colName];
                                                                        if (maxLen > 0 && maxLen < 10000000 && strVal.Length > maxLen)
                                                                        {
                                                                            strVal = strVal.Substring(0, maxLen);
                                                                        }
                                                                        paramValue = strVal;
                                                                    }
                                                                    else if (dbType.Contains("bit"))
                                                                    {
                                                                        paramValue = (val.ValueKind == JsonValueKind.True || strVal.Equals("true", StringComparison.OrdinalIgnoreCase) || strVal == "1");
                                                                    }
                                                                    // 改成：
                                                                    else if (dbType.Contains("int"))
                                                                    {
                                                                        if (long.TryParse(strVal, out long parsedLong)) paramValue = parsedLong;
                                                                        else isNull = true;
                                                                    }
                                                                    else if (dbType.Contains("float") || dbType.Contains("decimal") || dbType.Contains("numeric"))
                                                                    {
                                                                        if (double.TryParse(strVal, out double parsedDouble)) paramValue = parsedDouble;
                                                                        else isNull = true;
                                                                    }
                                                                    else if (dbType.Contains("date") || dbType.Contains("time"))
                                                                    {
                                                                        if (DateTime.TryParse(strVal, out DateTime parsedDate)) paramValue = parsedDate;
                                                                        else isNull = true;
                                                                    }
                                                                    else
                                                                    {
                                                                        paramValue = strVal;
                                                                    }
                                                                }
                                                                else
                                                                {
                                                                    paramValue = strVal;
                                                                }
                                                            }
                                                        }

                                                        validColumns.Add($"[{colName}]");

                                                        if (isNull || paramValue == null)
                                                        {
                                                            validParams.Add("NULL");
                                                        }
                                                        else
                                                        {
                                                            string paramName = "@p" + pIndex;
                                                            validParams.Add(paramName);
                                                            insertCmd.Parameters.AddWithValue(paramName, paramValue);
                                                            pIndex++;
                                                        }
                                                    }

                                                    if (validColumns.Count > 0)
                                                    {
                                                        insertCmd.CommandText = $"INSERT INTO [{tableName}] ({string.Join(", ", validColumns)}) VALUES ({string.Join(", ", validParams)})";

                                                        string savePoint = "Sp_" + Guid.NewGuid().ToString("N").Substring(0, 8);
                                                        trans.Save(savePoint);

                                                        try
                                                        {
                                                            insertCmd.ExecuteNonQuery();
                                                            successCount++;
                                                        }
                                                        catch (Exception sqlRowEx)
                                                        {
                                                            trans.Rollback(savePoint);
                                                            errorLogs.Add($"[{tableName}] (關鍵字: {rowIdentifier}) 寫入失敗 - {sqlRowEx.Message}");
                                                        }
                                                    }
                                                }
                                                catch (Exception preEx)
                                                {
                                                    errorLogs.Add($"[{tableName}] (關鍵字: {rowIdentifier}) 解析失敗 - {preEx.Message}");
                                                }
                                            }
                                        }
                                    }
                                    finally
                                    {
                                        if (hasIdentity)
                                        {
                                            try { using (SqlCommand cmdOff = new SqlCommand($"SET IDENTITY_INSERT [{tableName}] OFF", conn, trans)) { cmdOff.ExecuteNonQuery(); } } catch { }
                                        }
                                    }
                                }
                            }
                            trans.Commit();

                            if (errorLogs.Count > 0)
                            {
                                string htmlMsg = $"<b>匯入完畢，成功: {successCount} 筆，略過異常: {errorLogs.Count} 筆。</b><br><div style='max-height:250px; overflow-y:auto; text-align:left; font-size:0.8rem; margin-top:10px; padding:10px; background:#f8d7da; color:#721c24; border-radius:5px;'>";
                                htmlMsg += string.Join("<br>", errorLogs.Select(e => $"• {e}"));
                                htmlMsg += "</div><div style='margin-top:10px; font-size:0.8rem; color:#666;'>請檢查上述資料是否包含不合法的空值或是文字塞入數字欄位。正常的資料已順利寫入資料庫。</div>";
                                return Json(new { success = true, message = htmlMsg });
                            }

                            return Json(new { success = true, message = $"全部資料 ({successCount} 筆) 已成功同步至資料庫！" });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "伺服器寫入發生嚴重錯誤: " + ex.Message });
            }
        }

        // 登入後紀錄：LoginCount + 1、LastLoginTime = GETDATE()，並回傳更新後的數值
        public class LoginStatsRequest
        {
            public string? EmpId { get; set; }
        }

        [HttpPost]
        public async Task<JsonResult> UpdateLoginStats()
        {
            try
            {
                string empId = "";
                using (StreamReader reader = new StreamReader(Request.Body))
                {
                    string json = await reader.ReadToEndAsync();
                    if (!string.IsNullOrWhiteSpace(json))
                    {
                        var req = JsonSerializer.Deserialize<LoginStatsRequest>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        empId = req?.EmpId ?? "";
                    }
                }

                if (string.IsNullOrWhiteSpace(empId))
                    return Json(new { success = false, message = "EmpId 為必填欄位" });

                using (SqlConnection conn = new SqlConnection(connStr))
                {
                    conn.Open();

                    // 確認欄位存在，缺則自動新增（避免使用者忘了跑 ALTER）
                    using (SqlCommand alterCmd = new SqlCommand(@"
                        IF COL_LENGTH('Accounts','LoginCount') IS NULL
                            ALTER TABLE Accounts ADD LoginCount INT NULL;
                        IF COL_LENGTH('Accounts','LastLoginTime') IS NULL
                            ALTER TABLE Accounts ADD LastLoginTime DATETIME NULL;", conn))
                    {
                        alterCmd.ExecuteNonQuery();
                    }

                    // 1) 先 UPDATE 累計 +1（用獨立 Command 避免 NOCOUNT 影響）
                    int affected = 0;
                    using (SqlCommand updateCmd = new SqlCommand(@"
                        UPDATE Accounts
                        SET LoginCount = ISNULL(LoginCount, 0) + 1,
                            LastLoginTime = GETDATE()
                        WHERE EmpId = @EmpId;", conn))
                    {
                        updateCmd.Parameters.AddWithValue("@EmpId", empId);
                        affected = updateCmd.ExecuteNonQuery();
                    }

                    if (affected == 0)
                    {
                        return Json(new { success = false, message = "找不到帳號 " + empId });
                    }

                    // 2) 再 SELECT 取回最新值
                    using (SqlCommand selectCmd = new SqlCommand(@"
                        SELECT ISNULL(LoginCount, 0), LastLoginTime
                        FROM Accounts WHERE EmpId = @EmpId;", conn))
                    {
                        selectCmd.Parameters.AddWithValue("@EmpId", empId);
                        using (SqlDataReader r = selectCmd.ExecuteReader())
                        {
                            if (r.Read())
                            {
                                int loginCount = Convert.ToInt32(r.GetValue(0));
                                DateTime? lastLogin = r.IsDBNull(1) ? (DateTime?)null : Convert.ToDateTime(r.GetValue(1));
                                return Json(new
                                {
                                    success = true,
                                    loginCount = loginCount,
                                    lastLoginTime = lastLogin.HasValue ? lastLogin.Value.ToString("yyyy-MM-dd HH:mm:ss") : null
                                });
                            }
                        }
                    }
                }
                return Json(new { success = false, message = "找不到帳號 " + empId });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "更新登入紀錄失敗: " + ex.Message });
            }
        }
    }
}
