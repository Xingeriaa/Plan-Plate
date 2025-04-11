const sql = require('mssql');
const config = require('../config/db');
const auditLogService = require('../services/auditLogService');

// Get reports page
async function getReportsPage(req, res) {
  try {
    const period = req.query.period || 'month';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    // Get financial data
    const financialData = await getFinancialData(period, startDate, endDate);
    
    // Get top products
    const topProducts = await getTopProducts(period, startDate, endDate);
    
    // Get sales by category
    const salesByCategory = await getSalesByCategory(period, startDate, endDate);
    
    // Get customer statistics
    const customerStats = await getCustomerStats(period, startDate, endDate);
    
    res.render('admin/reports', {
      title: 'Báo Cáo Tài Chính',
      period,
      startDate,
      endDate,
      financialData,
      topProducts,
      salesByCategory,
      customerStats
    });
  } catch (error) {
    console.error('Error getting reports page:', error);
    res.status(500).send('Đã xảy ra lỗi khi tải trang báo cáo');
  }
}

// Get financial data
async function getFinancialData(period = 'month', startDate = null, endDate = null) {
  try {
    const pool = await sql.connect(config);
    
    // Determine date range based on period
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND dh.NgayDatHang BETWEEN @startDate AND @endDate';
      params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
      params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate) });
    } else {
      const today = new Date();
      let periodStartDate;
      
      if (period === 'week') {
        // Last 7 days
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 7);
      } else if (period === 'month') {
        // Current month
        periodStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        // Current year
        periodStartDate = new Date(today.getFullYear(), 0, 1);
      } else {
        // Default to last 30 days
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 30);
      }
      
      dateFilter = 'AND dh.NgayDatHang >= @periodStartDate';
      params.push({ name: 'periodStartDate', type: sql.DateTime, value: periodStartDate });
    }
    
    // Build query
    const query = `
      SELECT
        COUNT(DISTINCT dh.IDDonHang) AS TotalOrders,
        SUM(dh.TongTien) AS TotalRevenue,
        SUM(dh.TongTien) - SUM(ctdh.SoLuong * sp.GiaGoc) AS GrossProfit,
        AVG(dh.TongTien) AS AverageOrderValue,
        COUNT(DISTINCT dh.IDTaiKhoan) AS UniqueCustomers,
        SUM(CASE WHEN dh.TrangThai = 'DaGiao' THEN dh.TongTien ELSE 0 END) AS CompletedRevenue,
        SUM(CASE WHEN dh.TrangThai = 'Huy' THEN dh.TongTien ELSE 0 END) AS CancelledRevenue,
        COUNT(CASE WHEN dh.TrangThai = 'DaGiao' THEN 1 ELSE NULL END) AS CompletedOrders,
        COUNT(CASE WHEN dh.TrangThai = 'Huy' THEN 1 ELSE NULL END) AS CancelledOrders
      FROM DonHang dh
      LEFT JOIN ChiTietDonHang ctdh ON dh.IDDonHang = ctdh.IDDonHang
      LEFT JOIN QuanLySanPham sp ON ctdh.IDSanPham = sp.IDSanPham
      WHERE 1=1 ${dateFilter}
    `;
    
    // Execute query
    let request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    // Get daily revenue data for chart
    const dailyRevenueQuery = `
      SELECT 
        CONVERT(date, dh.NgayDatHang) AS OrderDate,
        SUM(dh.TongTien) AS DailyRevenue,
        COUNT(dh.IDDonHang) AS DailyOrders
      FROM DonHang dh
      WHERE 1=1 ${dateFilter}
      GROUP BY CONVERT(date, dh.NgayDatHang)
      ORDER BY OrderDate
    `;
    
    request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const dailyResult = await request.query(dailyRevenueQuery);
    
    // Format data for response
    const financialData = result.recordset[0];
    
    // Calculate additional metrics
    financialData.CancellationRate = financialData.TotalOrders > 0 
      ? (financialData.CancelledOrders / financialData.TotalOrders * 100).toFixed(2) 
      : 0;
      
    financialData.ProfitMargin = financialData.TotalRevenue > 0 
      ? (financialData.GrossProfit / financialData.TotalRevenue * 100).toFixed(2) 
      : 0;
      
    financialData.CustomerLifetimeValue = financialData.UniqueCustomers > 0 
      ? (financialData.TotalRevenue / financialData.UniqueCustomers).toFixed(2) 
      : 0;
    
    // Format daily data for chart
    const dailyData = {
      labels: dailyResult.recordset.map(item => {
        const date = new Date(item.OrderDate);
        return date.toLocaleDateString('vi-VN');
      }),
      revenue: dailyResult.recordset.map(item => item.DailyRevenue || 0),
      orders: dailyResult.recordset.map(item => item.DailyOrders || 0)
    };
    
    return {
      summary: financialData,
      dailyData
    };
  } catch (error) {
    console.error('Error getting financial data:', error);
    return {
      summary: {
        TotalOrders: 0,
        TotalRevenue: 0,
        GrossProfit: 0,
        AverageOrderValue: 0,
        UniqueCustomers: 0,
        CompletedRevenue: 0,
        CancelledRevenue: 0,
        CompletedOrders: 0,
        CancelledOrders: 0,
        CancellationRate: 0,
        ProfitMargin: 0,
        CustomerLifetimeValue: 0
      },
      dailyData: {
        labels: [],
        revenue: [],
        orders: []
      }
    };
  }
}

// Get top products
async function getTopProducts(period = 'month', startDate = null, endDate = null, limit = 10) {
  try {
    const pool = await sql.connect(config);
    
    // Determine date range based on period
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND dh.NgayDatHang BETWEEN @startDate AND @endDate';
      params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
      params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate) });
    } else {
      const today = new Date();
      let periodStartDate;
      
      if (period === 'week') {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 7);
      } else if (period === 'month') {
        periodStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        periodStartDate = new Date(today.getFullYear(), 0, 1);
      } else {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 30);
      }
      
      dateFilter = 'AND dh.NgayDatHang >= @periodStartDate';
      params.push({ name: 'periodStartDate', type: sql.DateTime, value: periodStartDate });
    }
    
    // Build query
    const query = `
      SELECT TOP ${limit}
        sp.IDSanPham,
        sp.TenSanPham,
        sp.HinhAnhSanPham,
        SUM(ctdh.SoLuong) AS TotalQuantity,
        SUM(ctdh.SoLuong * ctdh.DonGia) AS TotalRevenue,
        COUNT(DISTINCT dh.IDDonHang) AS OrderCount,
        dm.TenDanhMuc
      FROM ChiTietDonHang ctdh
      JOIN DonHang dh ON ctdh.IDDonHang = dh.IDDonHang
      JOIN QuanLySanPham sp ON ctdh.IDSanPham = sp.IDSanPham
      LEFT JOIN DanhMucSanPham dm ON sp.IDDanhMuc = dm.IDDanhMuc
      WHERE 1=1 ${dateFilter}
      GROUP BY sp.IDSanPham, sp.TenSanPham, sp.HinhAnhSanPham, dm.TenDanhMuc
      ORDER BY TotalRevenue DESC
    `;
    
    // Execute query
    let request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting top products:', error);
    return [];
  }
}

// Get sales by category
async function getSalesByCategory(period = 'month', startDate = null, endDate = null) {
  try {
    const pool = await sql.connect(config);
    
    // Determine date range based on period
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND dh.NgayDatHang BETWEEN @startDate AND @endDate';
      params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
      params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate) });
    } else {
      const today = new Date();
      let periodStartDate;
      
      if (period === 'week') {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 7);
      } else if (period === 'month') {
        periodStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        periodStartDate = new Date(today.getFullYear(), 0, 1);
      } else {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 30);
      }
      
      dateFilter = 'AND dh.NgayDatHang >= @periodStartDate';
      params.push({ name: 'periodStartDate', type: sql.DateTime, value: periodStartDate });
    }
    
    // Build query
    const query = `
      SELECT
        dm.IDDanhMuc,
        dm.TenDanhMuc,
        SUM(ctdh.SoLuong * ctdh.DonGia) AS TotalRevenue,
        COUNT(DISTINCT dh.IDDonHang) AS OrderCount,
        SUM(ctdh.SoLuong) AS TotalQuantity
      FROM ChiTietDonHang ctdh
      JOIN DonHang dh ON ctdh.IDDonHang = dh.IDDonHang
      JOIN QuanLySanPham sp ON ctdh.IDSanPham = sp.IDSanPham
      JOIN DanhMucSanPham dm ON sp.IDDanhMuc = dm.IDDanhMuc
      WHERE 1=1 ${dateFilter}
      GROUP BY dm.IDDanhMuc, dm.TenDanhMuc
      ORDER BY TotalRevenue DESC
    `;
    
    // Execute query
    let request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting sales by category:', error);
    return [];
  }
}

// Get customer statistics
async function getCustomerStats(period = 'month', startDate = null, endDate = null) {
  try {
    const pool = await sql.connect(config);
    
    // Determine date range based on period
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND dh.NgayDatHang BETWEEN @startDate AND @endDate';
      params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
      params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate) });
    } else {
      const today = new Date();
      let periodStartDate;
      
      if (period === 'week') {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 7);
      } else if (period === 'month') {
        periodStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        periodStartDate = new Date(today.getFullYear(), 0, 1);
      } else {
        periodStartDate = new Date(today);
        periodStartDate.setDate(today.getDate() - 30);
      }
      
      dateFilter = 'AND dh.NgayDatHang >= @periodStartDate';
      params.push({ name: 'periodStartDate', type: sql.DateTime, value: periodStartDate });
    }
    
    // Build query for top customers
    const topCustomersQuery = `
      SELECT TOP 5
        tk.IDTaiKhoan,
        tk.TenNguoiDung,
        tk.Email,
        COUNT(dh.IDDonHang) AS OrderCount,
        SUM(dh.TongTien) AS TotalSpent,
        MAX(dh.NgayDatHang) AS LastOrderDate
      FROM DonHang dh
      JOIN TaiKhoan tk ON dh.IDTaiKhoan = tk.IDTaiKhoan
      WHERE 1=1 ${dateFilter}
      GROUP BY tk.IDTaiKhoan, tk.TenNguoiDung, tk.Email
      ORDER BY TotalSpent DESC
    `;
    
    // Execute query
    let request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const topCustomersResult = await request.query(topCustomersQuery);
    
    // Build query for new vs returning customers
    const customerTypeQuery = `
      SELECT
        COUNT(DISTINCT CASE 
          WHEN (SELECT COUNT(*) FROM DonHang dh2 WHERE dh2.IDTaiKhoan = dh.IDTaiKhoan AND dh2.NgayDatHang < dh.NgayDatHang) = 0 
          THEN dh.IDTaiKhoan ELSE NULL END) AS NewCustomers,
        COUNT(DISTINCT CASE 
          WHEN (SELECT COUNT(*) FROM DonHang dh2 WHERE dh2.IDTaiKhoan = dh.IDTaiKhoan AND dh2.NgayDatHang < dh.NgayDatHang) > 0 
          THEN dh.IDTaiKhoan ELSE NULL END) AS ReturningCustomers
      FROM DonHang dh
      WHERE 1=1 ${dateFilter}
    `;
    
    request = pool.request();
    params.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const customerTypeResult = await request.query(customerTypeQuery);
    
    return {
      topCustomers: topCustomersResult.recordset,
      customerTypes: customerTypeResult.recordset[0]
    };
  } catch (error) {
    console.error('Error getting customer stats:', error);
    return {
      topCustomers: [],
      customerTypes: {
        NewCustomers: 0,
        ReturningCustomers: 0
      }
    };
  }
}

// Export reports as CSV
async function exportReports(req, res) {
  try {
    const period = req.query.period || 'month';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    // Get financial data
    const financialData = await getFinancialData(period, startDate, endDate);
    
    // Get top products
    const topProducts = await getTopProducts(period, startDate, endDate, 100); // Get more products for export
    
    // Get sales by category
    const salesByCategory = await getSalesByCategory(period, startDate, endDate);
    
    // Create CSV content
    let csv = 'Báo Cáo Tài Chính PlannPlate\n';
    csv += `Thời gian: ${startDate && endDate ? `${startDate} đến ${endDate}` : period === 'week' ? '7 ngày qua' : period === 'month' ? 'Tháng này' : 'Năm này'}\n\n`;
    
    // Financial summary
    csv += 'TỔNG QUAN TÀI CHÍNH\n';
    csv += `Tổng đơn hàng,${financialData.summary.TotalOrders}\n`;
    csv += `Tổng doanh thu,₫${financialData.summary.TotalRevenue.toLocaleString('vi-VN')}\n`;
    csv += `Lợi nhuận gộp,₫${financialData.summary.GrossProfit.toLocaleString('vi-VN')}\n`;
    csv += `Tỷ suất lợi nhuận,${financialData.summary.ProfitMargin}%\n`;
    csv += `Giá trị đơn hàng trung bình,₫${financialData.summary.AverageOrderValue.toLocaleString('vi-VN')}\n`;
    csv += `Số khách hàng,${financialData.summary.UniqueCustomers}\n`;
    csv += `Giá trị vòng đời khách hàng,₫${financialData.summary.CustomerLifetimeValue.toLocaleString('vi-VN')}\n\n`;
    
    // Top products
    csv += 'SẢN PHẨM BÁN CHẠY\n';
    csv += 'ID,Tên sản phẩm,Danh mục,Số lượng bán,Doanh thu,Số đơn hàng\n';
    
    topProducts.forEach(product => {
      csv += `${product.IDSanPham},"${product.TenSanPham}","${product.TenDanhMuc || ''}",${product.TotalQuantity},₫${product.TotalRevenue.toLocaleString('vi-VN')},${product.OrderCount}\n`;
    });
    
    csv += '\n';
    
    // Sales by category
    csv += 'DOANH THU THEO DANH MỤC\n';
    csv += 'ID,Danh mục,Doanh thu,Số đơn hàng,Số lượng bán\n';
    
    salesByCategory.forEach(category => {
      csv += `${category.IDDanhMuc},"${category.TenDanhMuc}",₫${category.TotalRevenue.toLocaleString('vi-VN')},${category.OrderCount},${category.TotalQuantity}\n`;
    });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bao-cao-tai-chinh-${new Date().toISOString().slice(0, 10)}.csv`);
    
    // Send CSV content
    res.send(csv);
  } catch (error) {
    console.error('Error exporting reports:', error);
    res.status(500).send('Đã xảy ra lỗi khi xuất báo cáo');
  }
}

module.exports = {
  getReportsPage,
  exportReports
};