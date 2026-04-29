```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Data.SqlClient;
using System.Collections.Generic;
using System;
using System.Data;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// ===== 請填入您的 MS SQL 連線字串 =====
string connStr = "Server=localhost;Database=YOUR_DB;User Id=YOUR_USER;Password=YOUR_PWD;TrustServerCertificate=True;";

// 1. 取得所有資料
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

// 2. 新增單筆資料
app.MapPost("/api/tasks", async (TaskDto dto) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var transaction = conn.BeginTransaction();

    try
    {
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

// 3. 批次匯入資料 (清空並重新建立)
app.MapPost("/api/tasks/import", async (List<TaskDto> dtos) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var transaction = conn.BeginTransaction();

    try
    {
        // 刪除明細表、主表，並將流水號歸零
        var cleanDbCmd = @"
            DELETE FROM TaskStation;
            DELETE FROM TaskCenter;
            DBCC CHECKIDENT ('TaskCenter', RESEED, 0);";
        
        using var cmdClean = new SqlCommand(cleanDbCmd, conn, transaction);
        await cmdClean.ExecuteNonQueryAsync();

        // 準備新增指令
        var insertMain = @"
            INSERT INTO TaskCenter (RegDate, Status, Department, Section, Applicant, Description, Owner, Benefit, DBCat, TCD, AppLink, DataSource)
            OUTPUT INSERTED.RegId
            VALUES (@RegDate, @Status, @Department, @Section, @Applicant, @Description, @Owner, @Benefit, @DBCat, @TCD, @AppLink, @DataSource)";

        var insertStation = "INSERT INTO TaskStation (TaskRegId, StationName, MpValue, UrlLink) VALUES (@TaskRegId, @StationName, @MpValue, @UrlLink)";

        foreach (var dto in dtos)
        {
            using var cmdMain = new SqlCommand(insertMain, conn, transaction);
            cmdMain.Parameters.AddWithValue("@RegDate", dto.Date ?? DateTime.Now.ToString("yyyy-MM-dd"));
            cmdMain.Parameters.AddWithValue("@Status", dto.Status ?? "缺欄位");
            cmdMain.Parameters.AddWithValue("@Department", dto.Dept ?? "");
            cmdMain.Parameters.AddWithValue("@Section", dto.Sec ?? "");
            cmdMain.Parameters.AddWithValue("@Applicant", dto.Applicant ?? "");
            cmdMain.Parameters.AddWithValue("@Description", dto.Desc ?? "");
            cmdMain.Parameters.AddWithValue("@Owner", dto.Owner ?? "");
            cmdMain.Parameters.AddWithValue("@Benefit", dto.Benefit);
            cmdMain.Parameters.AddWithValue("@DBCat", dto.DbCat ?? "");
            cmdMain.Parameters.AddWithValue("@TCD", dto.Tcd ?? "");
            cmdMain.Parameters.AddWithValue("@AppLink", dto.AppLink ?? "");
            cmdMain.Parameters.AddWithValue("@DataSource", dto.DataSource ?? "");

            int newRegId = (int)await cmdMain.ExecuteScalarAsync();

            if (dto.Stations != null && dto.Stations.Count > 0)
            {
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
        }
        transaction.Commit();
        return Results.Ok(new { success = true, count = dtos.Count });
    }
    catch (Exception ex)
    {
        transaction.Rollback();
        return Results.Problem(ex.Message);
    }
});

// 4. 更新單筆資料
app.MapPut("/api/tasks/{id}", async (int id, TaskDto dto) =>
{
    using var conn = new SqlConnection(connStr);
    await conn.OpenAsync();
    using var transaction = conn.BeginTransaction();

    try
    {
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

// 5. 刪除資料
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


```
