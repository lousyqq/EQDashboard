using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Data.SqlClient;
using System.Collections.Generic;
using System;
using System.Data;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// 啟用靜態檔案支援 (讓程式可以讀取 wwwroot 資料夾下的 index.html)
app.UseDefaultFiles();
app.UseStaticFiles();

// ===== 請填入您的 MS SQL 連線字串 =====
string connStr = "Server=localhost;Database=YOUR_DB;User Id=YOUR_USER;Password=YOUR_PWD;TrustServerCertificate=True;";

// 1. 取得所有資料 (Read) - JOIN 主表與明細表
app.MapGet("/api/tasks", async () =>
{
    var tasks = new Dictionary<int, TaskDto>();

    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    
    var query = @"
        SELECT t.RegId, t.RegDate, t.Status, t.Department, t.Section, t.Applicant, t.Description, 
               t.Owner, t.Benefit, t.DBCat, t.TCD, t.AppLink, t.DataSource,
               s.StationName, s.MpValue, s.UrlLink
        FROM TaskCenter t
        LEFT JOIN TaskStation s ON t.RegId = s.TaskRegId
        ORDER BY t.RegId ASC";

    using var cmd = new SqlCommand(query, conn);
    using var reader = await cmd.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
        int regId = reader.GetInt32(0);
        if (!tasks.ContainsKey(regId))
        {
            tasks[regId] = new TaskDto
            {
                RegId = regId,
                Date = reader.GetDateTime(1).ToString("yyyy-MM-dd"),
                Status = reader.GetString(2),
                Dept = reader.IsDBNull(3) ? "" : reader.GetString(3),
                Sec = reader.IsDBNull(4) ? "" : reader.GetString(4),
                Applicant = reader.IsDBNull(5) ? "" : reader.GetString(5),
                Desc = reader.IsDBNull(6) ? "" : reader.GetString(6),
                Owner = reader.IsDBNull(7) ? "" : reader.GetString(7),
                Benefit = reader.IsDBNull(8) ? 0 : reader.GetDouble(8),
                DbCat = reader.IsDBNull(9) ? "" : reader.GetString(9),
                Tcd = reader.IsDBNull(10) ? "" : reader.GetString(10),
                AppLink = reader.IsDBNull(11) ? "" : reader.GetString(11),
                DataSource = reader.IsDBNull(12) ? "" : reader.GetString(12),
                Stations = new List<StationDto>()
            };
        }

        // 如果該任務有關聯的站點資料，則加入 List 中
        if (!reader.IsDBNull(13))
        {
            tasks[regId].Stations.Add(new StationDto
            {
                StationName = reader.GetString(13),
                MpValue = reader.IsDBNull(14) ? "" : reader.GetString(14),
                UrlLink = reader.IsDBNull(15) ? "" : reader.GetString(15)
            });
        }
    }

    return Results.Ok(tasks.Values);
});

// 2. 新增資料 (Create) - 使用 Transaction 確保主表與明細表同時成功寫入
app.MapPost("/api/tasks", async (TaskDto dto) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var transaction = conn.BeginTransaction();

    try
    {
        // 新增至主表並取得 RegId
        var insertMain = @"
            INSERT INTO TaskCenter (RegDate, Status, Department, Section, Applicant, Description, Owner, Benefit, DBCat, TCD, AppLink, DataSource)
            OUTPUT INSERTED.RegId
            VALUES (@RegDate, @Status, @Department, @Section, @Applicant, @Description, @Owner, @Benefit, @DBCat, @TCD, @AppLink, @DataSource)";
        
        using var cmdMain = new SqlCommand(insertMain, conn, transaction);
        cmdMain.Parameters.AddWithValue("@RegDate", dto.Date);
        cmdMain.Parameters.AddWithValue("@Status", dto.Status);
        cmdMain.Parameters.AddWithValue("@Department", dto.Dept);
        cmdMain.Parameters.AddWithValue("@Section", dto.Sec);
        cmdMain.Parameters.AddWithValue("@Applicant", dto.Applicant);
        cmdMain.Parameters.AddWithValue("@Description", dto.Desc);
        cmdMain.Parameters.AddWithValue("@Owner", dto.Owner ?? "");
        cmdMain.Parameters.AddWithValue("@Benefit", dto.Benefit);
        cmdMain.Parameters.AddWithValue("@DBCat", dto.DbCat ?? "");
        cmdMain.Parameters.AddWithValue("@TCD", dto.Tcd ?? "");
        cmdMain.Parameters.AddWithValue("@AppLink", dto.AppLink ?? "");
        cmdMain.Parameters.AddWithValue("@DataSource", dto.DataSource ?? "");

        int newRegId = (int)await cmdMain.ExecuteScalarAsync();

        // 迴圈新增至明細表
        if (dto.Stations != null && dto.Stations.Count > 0)
        {
            var insertStation = "INSERT INTO TaskStation (TaskRegId, StationName, MpValue, UrlLink) VALUES (@TaskRegId, @StationName, @MpValue, @UrlLink)";
            foreach (var st in dto.Stations)
            {
                using var cmdSt = new SqlCommand(insertStation, conn, transaction);
                cmdSt.Parameters.AddWithValue("@TaskRegId", newRegId);
                cmdSt.Parameters.AddWithValue("@StationName", st.StationName);
                cmdSt.Parameters.AddWithValue("@MpValue", st.MpValue ?? "");
                cmdSt.Parameters.AddWithValue("@UrlLink", st.UrlLink ?? "");
                await cmdSt.ExecuteNonQueryAsync();
            }
        }

        transaction.Commit();
        return Results.Ok(new { success = true, regId = newRegId });
    }
    catch (Exception ex)
    {
        transaction.Rollback();
        return Results.Problem(ex.Message);
    }
});

// 3. 更新資料 (Update)
app.MapPut("/api/tasks/{id}", async (int id, TaskDto dto) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var transaction = conn.BeginTransaction();

    try
    {
        // 更新主表
        var updateMain = @"
            UPDATE TaskCenter SET 
                Status=@Status, Owner=@Owner, Benefit=@Benefit, DBCat=@DBCat, 
                TCD=@TCD, AppLink=@AppLink, DataSource=@DataSource
            WHERE RegId=@RegId";
            
        using var cmdMain = new SqlCommand(updateMain, conn, transaction);
        cmdMain.Parameters.AddWithValue("@RegId", id);
        cmdMain.Parameters.AddWithValue("@Status", dto.Status);
        cmdMain.Parameters.AddWithValue("@Owner", dto.Owner ?? "");
        cmdMain.Parameters.AddWithValue("@Benefit", dto.Benefit);
        cmdMain.Parameters.AddWithValue("@DBCat", dto.DbCat ?? "");
        cmdMain.Parameters.AddWithValue("@TCD", dto.Tcd ?? "");
        cmdMain.Parameters.AddWithValue("@AppLink", dto.AppLink ?? "");
        cmdMain.Parameters.AddWithValue("@DataSource", dto.DataSource ?? "");
        await cmdMain.ExecuteNonQueryAsync();

        // 處理明細表：先刪除舊有站點，再寫入新站點
        var deleteOldStations = "DELETE FROM TaskStation WHERE TaskRegId = @RegId";
        using var cmdDel = new SqlCommand(deleteOldStations, conn, transaction);
        cmdDel.Parameters.AddWithValue("@RegId", id);
        await cmdDel.ExecuteNonQueryAsync();

        if (dto.Stations != null && dto.Stations.Count > 0)
        {
            var insertStation = "INSERT INTO TaskStation (TaskRegId, StationName, MpValue, UrlLink) VALUES (@TaskRegId, @StationName, @MpValue, @UrlLink)";
            foreach (var st in dto.Stations)
            {
                using var cmdSt = new SqlCommand(insertStation, conn, transaction);
                cmdSt.Parameters.AddWithValue("@TaskRegId", id);
                cmdSt.Parameters.AddWithValue("@StationName", st.StationName);
                cmdSt.Parameters.AddWithValue("@MpValue", st.MpValue ?? "");
                cmdSt.Parameters.AddWithValue("@UrlLink", st.UrlLink ?? "");
                await cmdSt.ExecuteNonQueryAsync();
            }
        }

        transaction.Commit();
        return Results.Ok(new { success = true });
    }
    catch (Exception ex)
    {
        transaction.Rollback();
        return Results.Problem(ex.Message);
    }
});

// 4. 刪除資料 (Delete) - 資料庫中的 CASCADE 會自動刪除對應的站點資料
app.MapDelete("/api/tasks/{id}", async (int id) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var cmd = new SqlCommand("DELETE FROM TaskCenter WHERE RegId=@RegId", conn);
    cmd.Parameters.AddWithValue("@RegId", id);
    await cmd.ExecuteNonQueryAsync();
    
    return Results.Ok(new { success = true });
});

app.Run();

// 定義資料結構 Model
public class TaskDto
{
    public int RegId { get; set; }
    public string Date { get; set; }
    public string Status { get; set; }
    public string Dept { get; set; }
    public string Sec { get; set; }
    public string Applicant { get; set; }
    public string Desc { get; set; }
    public string Owner { get; set; }
    public double Benefit { get; set; }
    public string DbCat { get; set; }
    public string Tcd { get; set; }
    public string AppLink { get; set; }
    public string DataSource { get; set; }
    public List<StationDto> Stations { get; set; }
}

public class StationDto
{
    public string StationName { get; set; }
    public string MpValue { get; set; }
    public string UrlLink { get; set; }
}