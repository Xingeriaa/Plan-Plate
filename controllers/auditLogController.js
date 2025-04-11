const auditLogService = require('../services/auditLogService');

// Get audit logs page
async function getAuditLogsPage(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Get filters from query params
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      entityType: req.query.entityType || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };
    
    // Remove null filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) {
        delete filters[key];
      }
    });
    
    const result = await auditLogService.getAllLogs(page, limit, filters);
    
    res.render('admin/audit-logs', {
      logs: result.logs,
      pagination: result.pagination,
      filters: filters,
      title: 'Nhật Ký Hệ Thống'
    });
  } catch (error) {
    console.error('Error getting audit logs page:', error);
    res.status(500).send('Đã xảy ra lỗi khi tải trang nhật ký hệ thống');
  }
}

// Export audit logs as CSV
async function exportAuditLogs(req, res) {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      entityType: req.query.entityType || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };
    
    // Remove null filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) {
        delete filters[key];
      }
    });
    
    // Get all logs without pagination
    const result = await auditLogService.getAllLogs(1, 10000, filters);
    const logs = result.logs;
    
    // Create CSV content
    let csv = 'ID,User,Action,Description,Entity Type,Entity ID,Timestamp,IP Address\n';
    
    logs.forEach(log => {
      csv += `${log.IDAuditLog},"${log.user}","${log.action}","${log.description.replace(/"/g, '""')}","${log.entityType}",${log.entityId},"${new Date(log.timestamp).toLocaleString('vi-VN')}","${log.ipAddress}"\n`;
    });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    
    // Send CSV content
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).send('Đã xảy ra lỗi khi xuất nhật ký hệ thống');
  }
}

module.exports = {
  getAuditLogsPage,
  exportAuditLogs
};