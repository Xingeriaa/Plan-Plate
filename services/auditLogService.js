const sql = require('mssql');
const config = require('../config/db');

// Log admin actions
async function logAction(userId, action, description, entityType, entityId, oldData = null, newData = null, ipAddress = '0.0.0.0') {
  try {
    const pool = await sql.connect(config);
    const timestamp = new Date().toISOString();
    
    // Get user information
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT TenNguoiDung, Email FROM TaiKhoan WHERE IDTaiKhoan = @userId');
    
    const user = userResult.recordset[0];
    const userName = user ? user.TenNguoiDung : 'Người dùng không xác định';
    
    // Insert into audit log table
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('userName', sql.NVarChar, userName)
      .input('action', sql.VarChar, action)
      .input('description', sql.NVarChar, description)
      .input('entityType', sql.VarChar, entityType)
      .input('entityId', sql.Int, entityId)
      .input('timestamp', sql.DateTime, timestamp)
      .input('ipAddress', sql.VarChar, ipAddress)
      .input('oldData', sql.NVarChar, oldData ? JSON.stringify(oldData) : null)
      .input('newData', sql.NVarChar, newData ? JSON.stringify(newData) : null)
      .query(`
        INSERT INTO AuditLog (IDTaiKhoan, TenNguoiDung, HanhDong, MoTa, LoaiDoiTuong, IDDoiTuong, ThoiGian, DiaChiIP, DuLieuCu, DuLieuMoi)
        VALUES (@userId, @userName, @action, @description, @entityType, @entityId, @timestamp, @ipAddress, @oldData, @newData)
      `);
      
    console.log(`Audit log created: ${action} by ${userName}`);
    return true;
  } catch (error) {
    console.error('Error creating audit log:', error);
    return false;
  }
}

// Get recent audit logs
async function getRecentLogs(limit = 10) {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) 
          IDAuditLog,
          TenNguoiDung as user,
          HanhDong as action,
          MoTa as description,
          LoaiDoiTuong as entityType,
          IDDoiTuong as entityId,
          ThoiGian as timestamp,
          DiaChiIP as ipAddress
        FROM AuditLog
        ORDER BY ThoiGian DESC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}

// Get all audit logs with pagination and filtering
async function getAllLogs(page = 1, limit = 20, filters = {}) {
  try {
    const pool = await sql.connect(config);
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        IDAuditLog,
        CASE 
          WHEN TenNguoiDung IS NULL OR TenNguoiDung = '' THEN 
            (SELECT TenNguoiDung FROM TaiKhoan WHERE IDTaiKhoan = AuditLog.IDTaiKhoan)
          ELSE TenNguoiDung 
        END as user,
        HanhDong as action,
        MoTa as description,
        LoaiDoiTuong as entityType,
        IDDoiTuong as entityId,
        ThoiGian as timestamp,
        DiaChiIP as ipAddress,
        DuLieuCu as oldData,
        DuLieuMoi as newData
      FROM AuditLog
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Add filters
    if (filters.userId) {
      query += ` AND IDTaiKhoan = @userId`;
      queryParams.push({ name: 'userId', type: sql.Int, value: filters.userId });
    }
    
    if (filters.action) {
      query += ` AND HanhDong = @action`;
      queryParams.push({ name: 'action', type: sql.VarChar, value: filters.action });
    }
    
    if (filters.entityType) {
      query += ` AND LoaiDoiTuong = @entityType`;
      queryParams.push({ name: 'entityType', type: sql.VarChar, value: filters.entityType });
    }
    
    if (filters.startDate && filters.endDate) {
      query += ` AND ThoiGian BETWEEN @startDate AND @endDate`;
      queryParams.push({ name: 'startDate', type: sql.DateTime, value: new Date(filters.startDate) });
      queryParams.push({ name: 'endDate', type: sql.DateTime, value: new Date(filters.endDate) });
    }
    
    // Count total records
    const countQuery = query.replace(/SELECT\s+IDAuditLog,[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM');
    
    let request = pool.request();
    queryParams.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;
    
    // Add pagination
    query += ` ORDER BY ThoiGian DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    
    request = pool.request();
    queryParams.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    request = request
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit);
    
    const result = await request.query(query);
    
    return {
      logs: result.recordset,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching all audit logs:', error);
    return { logs: [], pagination: { total: 0, page, limit, totalPages: 0 } };
  }
}

module.exports = {
  logAction,
  getRecentLogs,
  getAllLogs
};