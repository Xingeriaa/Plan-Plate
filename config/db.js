const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true // For local dev / self-signed certs
  }
};

// Create a connection pool
const pool = new sql.ConnectionPool(config);

// Connect to database
async function connectDB() {
  try {
    await pool.connect();
    console.log('Connected to MSSQL database');
  } catch (err) {
    console.error('Database connection error:', err);
    // Retry connection after delay
    setTimeout(connectDB, 5000);
  }
}

// Initialize connection
connectDB();

// Generic query function
async function query(sqlQuery) {
  try {
    return await pool.request().query(sqlQuery);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Admin dashboard functions

// Get dashboard statistics
async function getDashboardStats() {
  try {
    // Get user count
    const userCountResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM TaiKhoan
    `);
    
    // Get new users this month
    const newUsersResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM TaiKhoan
      WHERE MONTH(NgayTao) = MONTH(GETDATE()) AND YEAR(NgayTao) = YEAR(GETDATE())
    `);
    
    // Get product count
    const productCountResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM QuanLySanPham
    `);
    
    // Get low stock products count
    const lowStockResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM QuanLyKhoHang
      WHERE SoLuongTon <= 5
    `);
    
    // Get order count
    const orderCountResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM DonHang
    `);
    
    // Get pending orders count
    const pendingOrdersResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM DonHang
      WHERE TrangThai = 'ChoXuLy'
    `);
    
    // Get total revenue
    const totalRevenueResult = await pool.request().query(`
      SELECT ISNULL(SUM(TongTien), 0) AS total FROM DonHang
      WHERE TrangThai != 'Huy'
    `);
    
    // Get monthly revenue
    const monthlyRevenueResult = await pool.request().query(`
      SELECT ISNULL(SUM(TongTien), 0) AS total FROM DonHang
      WHERE MONTH(NgayDat) = MONTH(GETDATE()) 
      AND YEAR(NgayDat) = YEAR(GETDATE())
      AND TrangThai != 'Huy'
    `);
    
    return {
      userCount: userCountResult.recordset[0].total,
      newUsers: newUsersResult.recordset[0].total,
      productCount: productCountResult.recordset[0].total,
      lowStockCount: lowStockResult.recordset[0].total,
      orderCount: orderCountResult.recordset[0].total,
      pendingOrders: pendingOrdersResult.recordset[0].total,
      totalRevenue: totalRevenueResult.recordset[0].total,
      monthlyRevenue: monthlyRevenueResult.recordset[0].total
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
}

// Get recent orders for dashboard
async function getRecentOrders(limit = 5) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) d.*, t.TenNguoiDung as TenKhachHang
        FROM DonHang d
        LEFT JOIN TaiKhoan t ON d.IDKhachHang = t.IDTaiKhoan
        ORDER BY d.NgayDat DESC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting recent orders:', error);
    throw error;
  }
}

// Get low stock products for dashboard
async function getLowStockProducts(limit = 5) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) p.*, c.TenDanhMuc, k.SoLuongTon
        FROM QuanLySanPham p
        JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
        LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        WHERE k.SoLuongTon <= 5
        ORDER BY k.SoLuongTon ASC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting low stock products:', error);
    throw error;
  }
}

// Get sales data for chart
async function getSalesData(period = 'month') {
  try {
    let query = '';
    
    if (period === 'week') {
      // Last 7 days
      query = `
        SELECT 
          CONVERT(VARCHAR(10), DATEADD(DAY, -numbers.number, GETDATE()), 120) AS date,
          ISNULL(SUM(d.TongTien), 0) AS total
        FROM 
          (SELECT 0 AS number UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) AS numbers
        LEFT JOIN 
          DonHang d ON CONVERT(DATE, d.NgayDat) = CONVERT(DATE, DATEADD(DAY, -numbers.number, GETDATE()))
          AND d.TrangThai != 'Huy'
        GROUP BY 
          DATEADD(DAY, -numbers.number, GETDATE())
        ORDER BY 
          date ASC
      `;
    } else if (period === 'month') {
      // Last 30 days
      query = `
        SELECT 
          DATEPART(DAY, d.NgayDat) AS day,
          ISNULL(SUM(d.TongTien), 0) AS total
        FROM 
          DonHang d
        WHERE 
          d.NgayDat >= DATEADD(DAY, -30, GETDATE())
          AND d.TrangThai != 'Huy'
        GROUP BY 
          DATEPART(DAY, d.NgayDat)
        ORDER BY 
          day ASC
      `;
    } else if (period === 'year') {
      // Last 12 months
      query = `
        SELECT 
          DATEPART(MONTH, d.NgayDat) AS month,
          ISNULL(SUM(d.TongTien), 0) AS total
        FROM 
          DonHang d
        WHERE 
          d.NgayDat >= DATEADD(MONTH, -12, GETDATE())
          AND d.TrangThai != 'Huy'
        GROUP BY 
          DATEPART(MONTH, d.NgayDat)
        ORDER BY 
          month ASC
      `;
    }
    
    const result = await pool.request().query(query);
    
    // Format data for chart.js
    const labels = [];
    const values = [];
    
    if (period === 'week') {
      result.recordset.forEach(row => {
        labels.push(row.date);
        values.push(row.total);
      });
    } else if (period === 'month') {
      result.recordset.forEach(row => {
        labels.push(`Day ${row.day}`);
        values.push(row.total);
      });
    } else if (period === 'year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      result.recordset.forEach(row => {
        labels.push(monthNames[row.month - 1]);
        values.push(row.total);
      });
    }
    
    return { labels, values };
  } catch (error) {
    console.error('Error getting sales data:', error);
    throw error;
  }
}

// Get all users with pagination
async function getAllUsers(page = 1, pageSize = 10, search = '', role = '') {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT * FROM TaiKhoan
      WHERE 1=1
    `;
    
    if (search) {
      query += ` AND (TenNguoiDung LIKE @search OR Email LIKE @search)`;
    }
    
    if (role) {
      query += ` AND VaiTro = @role`;
    }
    
    query += `
      ORDER BY NgayTao DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;
    
    const request = pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize);
    
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    
    if (role) {
      request.input('role', sql.NVarChar, role);
    }
    
    const result = await request.query(query);
    
    // Count total users
    let countQuery = `
      SELECT COUNT(*) AS total FROM TaiKhoan
      WHERE 1=1
    `;
    
    if (search) {
      countQuery += ` AND (TenNguoiDung LIKE @search OR Email LIKE @search)`;
    }
    
    if (role) {
      countQuery += ` AND VaiTro = @role`;
    }
    
    const countRequest = pool.request();
    
    if (search) {
      countRequest.input('search', sql.NVarChar, `%${search}%`);
    }
    
    if (role) {
      countRequest.input('role', sql.NVarChar, role);
    }
    
    const countResult = await countRequest.query(countQuery);
    
    return {
      users: result.recordset,
      total: countResult.recordset[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.recordset[0].total / pageSize)
    };
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

// Get user by ID
async function getUserById(id) {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT * FROM TaiKhoan
        WHERE IDTaiKhoan = @id
      `);
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

// Add new user (admin function)
async function addUser(userData) {
  try {
    const { fullName, email, password, role } = userData;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role || 'NguoiDung')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO TaiKhoan (TenNguoiDung, Email, MatKhau, VaiTro, NgayTao)
        VALUES (@fullName, @email, @password, @role, @createdAt)
        
        SELECT SCOPE_IDENTITY() AS id
      `);
    
    return { id: result.recordset[0].id, ...userData };
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

// Update user
async function updateUser(id, userData) {
  try {
    const { fullName, email, password, role } = userData;
    
    let query = `
      UPDATE TaiKhoan
      SET 
        TenNguoiDung = @fullName,
        Email = @email
    `;
    
    if (role) {
      query += `, VaiTro = @role`;
    }
    
    if (password) {
      query += `, MatKhau = @password`;
    }
    
    query += ` WHERE IDTaiKhoan = @id`;
    
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('role', sql.NVarChar, role);
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      request.input('password', sql.NVarChar, hashedPassword);
    }
    
    await request.query(query);
    
    return await getUserById(id);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Delete user
async function deleteUser(id) {
  try {
    // Check if user is an admin
    const userCheck = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT VaiTro FROM TaiKhoan
        WHERE IDTaiKhoan = @id
      `);
    
    if (userCheck.recordset[0]?.VaiTro === 'Admin') {
      throw new Error('Cannot delete admin user');
    }
    
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM TaiKhoan
        WHERE IDTaiKhoan = @id
      `);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// Get all categories
async function getAllCategories() {
  try {
    const result = await pool.request().query(`
      SELECT * FROM QuanLyDanhMuc
      ORDER BY TenDanhMuc
    `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting all categories:', error);
    throw error;
  }
}

// Add category
async function addCategory(categoryData) {
  try {
    const { name, description } = categoryData;
    
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`
        INSERT INTO QuanLyDanhMuc (TenDanhMuc, MoTa)
        VALUES (@name, @description)
        
        SELECT SCOPE_IDENTITY() AS id
      `);
    
    return { id: result.recordset[0].id, ...categoryData };
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
}

// Update category
async function updateCategory(id, categoryData) {
  try {
    const { name, description } = categoryData;
    
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`
        UPDATE QuanLyDanhMuc
        SET TenDanhMuc = @name, MoTa = @description
        WHERE IDDanhMuc = @id
      `);
    
    return { id, ...categoryData };
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

// Delete category
async function deleteCategory(id) {
  try {
    // Check if category has products
    const productCheck = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT COUNT(*) AS count FROM QuanLySanPham
        WHERE IDDanhMuc = @id
      `);
    
    if (productCheck.recordset[0].count > 0) {
      throw new Error('Cannot delete category with associated products');
    }
    
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM QuanLyDanhMuc
        WHERE IDDanhMuc = @id
      `);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

// Get order details with items
async function getOrderWithItems(orderId) {
  try {
    // Get order details
    const orderResult = await pool.request()
      .input('id', sql.Int, orderId)
      .query(`
        SELECT d.*, t.TenNguoiDung, t.Email, t.SoDienThoai, t.DiaChi
        FROM DonHang d
        LEFT JOIN TaiKhoan t ON d.IDKhachHang = t.IDTaiKhoan
        WHERE d.IDDonHang = @id
      `);
    
    if (orderResult.recordset.length === 0) {
      throw new Error('Order not found');
    }
    
    // Get order items
    const itemsResult = await pool.request()
      .input('id', sql.Int, orderId)
      .query(`
        SELECT c.*, p.TenSanPham, p.HinhAnhSanPham
        FROM ChiTietDonHang c
        JOIN QuanLySanPham p ON c.IDSanPham = p.IDSanPham
        WHERE c.IDDonHang = @id
      `);
    
    return {
      order: orderResult.recordset[0],
      items: itemsResult.recordset
    };
  } catch (error) {
    console.error('Error getting order details:', error);
    throw error;
  }
}

// Update order status
async function updateOrderStatus(orderId, status) {
  try {
    await pool.request()
      .input('id', sql.Int, orderId)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE DonHang
        SET TrangThai = @status
        WHERE IDDonHang = @id
      `);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

// Fix the getAllProducts function to use the correct SQL Server syntax and table names
async function getAllProducts(page = 1, pageSize = 10, search = '', category = '') {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT p.*, c.TenDanhMuc, k.SoLuongTon, k.DonViBan
      FROM QuanLySanPham p
      LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
      LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
      WHERE 1=1
    `;
    
    if (search) {
      query += ` AND (p.TenSanPham LIKE @search OR p.MoTa LIKE @search)`;
    }
    
    if (category) {
      query += ` AND p.IDDanhMuc = @category`;
    }
    
    query += `
      ORDER BY p.IDSanPham
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;
    
    const request = pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize);
    
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    
    if (category) {
      request.input('category', sql.Int, category);
    }
    
    const result = await request.query(query);
    
    // Count total products
    let countQuery = `
      SELECT COUNT(*) AS total FROM QuanLySanPham p
      WHERE 1=1
    `;
    
    if (search) {
      countQuery += ` AND (p.TenSanPham LIKE @search OR p.MoTa LIKE @search)`;
    }
    
    if (category) {
      countQuery += ` AND p.IDDanhMuc = @category`;
    }
    
    const countRequest = pool.request();
    
    if (search) {
      countRequest.input('search', sql.NVarChar, `%${search}%`);
    }
    
    if (category) {
      countRequest.input('category', sql.Int, category);
    }
    
    const countResult = await countRequest.query(countQuery);
    
    return {
      products: result.recordset,
      total: countResult.recordset[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.recordset[0].total / pageSize)
    };
  } catch (error) {
    console.error('Error getting all products:', error);
    throw error;
  }
}

// Add the missing getProductById function
async function getProductById(id) {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT p.*, c.TenDanhMuc, k.SoLuongTon, k.DonViBan
        FROM QuanLySanPham p
        LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
        WHERE p.IDSanPham = @id
      `);
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting product by ID:', error);
    throw error;
  }
}

// Add the missing addProduct function
async function addProduct(productData) {
  try {
    const { TenSanPham, MoTa, Gia, IDDanhMuc, HinhAnhSanPham, SoLuongTon, DonViBan } = productData;
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Insert product
      const productResult = await transaction.request()
        .input('TenSanPham', sql.NVarChar, TenSanPham)
        .input('MoTa', sql.NVarChar, MoTa || null)
        .input('Gia', sql.Decimal(10, 2), Gia)
        .input('IDDanhMuc', sql.Int, IDDanhMuc)
        .input('HinhAnhSanPham', sql.NVarChar, HinhAnhSanPham || null)
        .query(`
          INSERT INTO QuanLySanPham (TenSanPham, MoTa, Gia, IDDanhMuc, HinhAnhSanPham)
          VALUES (@TenSanPham, @MoTa, @Gia, @IDDanhMuc, @HinhAnhSanPham)
          
          SELECT SCOPE_IDENTITY() AS id
        `);
      
      const productId = productResult.recordset[0].id;
      
      // Insert inventory
      await transaction.request()
        .input('IDSanPham', sql.Int, productId)
        .input('SoLuongTon', sql.Int, SoLuongTon || 0)
        .input('DonViBan', sql.NVarChar, DonViBan || 'Cái')
        .query(`
          INSERT INTO QuanLyKhoHang (IDSanPham, SoLuongTon, DonViBan)
          VALUES (@IDSanPham, @SoLuongTon, @DonViBan)
        `);
      
      await transaction.commit();
      
      return { id: productId, ...productData };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

// Add the missing updateProduct function
async function updateProduct(id, productData) {
  try {
    const { TenSanPham, MoTa, Gia, IDDanhMuc, HinhAnhSanPham, SoLuongTon, DonViBan } = productData;
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Update product
      await transaction.request()
        .input('id', sql.Int, id)
        .input('TenSanPham', sql.NVarChar, TenSanPham)
        .input('MoTa', sql.NVarChar, MoTa || null)
        .input('Gia', sql.Decimal(10, 2), Gia)
        .input('IDDanhMuc', sql.Int, IDDanhMuc)
        .input('HinhAnhSanPham', sql.NVarChar, HinhAnhSanPham || null)
        .query(`
          UPDATE QuanLySanPham
          SET TenSanPham = @TenSanPham, 
              MoTa = @MoTa, 
              Gia = @Gia, 
              IDDanhMuc = @IDDanhMuc,
              HinhAnhSanPham = @HinhAnhSanPham
          WHERE IDSanPham = @id
        `);
      
      // Update inventory
      await transaction.request()
        .input('id', sql.Int, id)
        .input('SoLuongTon', sql.Int, SoLuongTon || 0)
        .input('DonViBan', sql.NVarChar, DonViBan || 'Cái')
        .query(`
          UPDATE QuanLyKhoHang
          SET SoLuongTon = @SoLuongTon, DonViBan = @DonViBan
          WHERE IDSanPham = @id
        `);
      
      await transaction.commit();
      
      return { id, ...productData };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

// Add the missing deleteProduct function
async function deleteProduct(id) {
  try {
    // Check if product has order items
    const orderCheck = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT COUNT(*) AS count FROM ChiTietDonHang
        WHERE IDSanPham = @id
      `);
    
    if (orderCheck.recordset[0].count > 0) {
      throw new Error('Cannot delete product with associated orders');
    }
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Delete inventory
      await transaction.request()
        .input('id', sql.Int, id)
        .query(`
          DELETE FROM QuanLyKhoHang
          WHERE IDSanPham = @id
        `);
      
      // Delete product
      await transaction.request()
        .input('id', sql.Int, id)
        .query(`
          DELETE FROM QuanLySanPham
          WHERE IDSanPham = @id
        `);
      
      await transaction.commit();
      
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// Add the missing getAllOrders function
async function getAllOrders(page = 1, pageSize = 10, status = '', search = '') {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT d.*, t.TenNguoiDung as TenKhachHang
      FROM DonHang d
      LEFT JOIN TaiKhoan t ON d.IDKhachHang = t.IDTaiKhoan
      WHERE 1=1
    `;
    
    if (status) {
      query += ` AND d.TrangThai = @status`;
    }
    
    if (search) {
      query += ` AND (t.TenNguoiDung LIKE @search OR CAST(d.IDDonHang AS NVARCHAR) LIKE @search)`;
    }
    
    query += `
      ORDER BY d.NgayDat DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;
    
    const request = pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize);
    
    if (status) {
      request.input('status', sql.NVarChar, status);
    }
    
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    
    const result = await request.query(query);
    
    // Count total orders
    let countQuery = `
      SELECT COUNT(*) AS total FROM DonHang d
      LEFT JOIN TaiKhoan t ON d.IDKhachHang = t.IDTaiKhoan
      WHERE 1=1
    `;
    
    if (status) {
      countQuery += ` AND d.TrangThai = @status`;
    }
    
    if (search) {
      countQuery += ` AND (t.TenNguoiDung LIKE @search OR CAST(d.IDDonHang AS NVARCHAR) LIKE @search)`;
    }
    
    const countRequest = pool.request();
    
    if (status) {
      countRequest.input('status', sql.NVarChar, status);
    }
    
    if (search) {
      countRequest.input('search', sql.NVarChar, `%${search}%`);
    }
    
    const countResult = await countRequest.query(countQuery);
    
    return {
      orders: result.recordset,
      total: countResult.recordset[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.recordset[0].total / pageSize)
    };
  } catch (error) {
    console.error('Error getting all orders:', error);
    throw error;
  }
}

// Add the module exports section at the end of the file
module.exports = {
  query,
  connectDB,
  getDashboardStats,
  getRecentOrders,
  getLowStockProducts,
  getSalesData,
  getAllUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  getOrderWithItems,
  updateOrderStatus
};
