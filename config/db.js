const sql = require('mssql');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); // Add missing bcrypt import

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
const pool = new sql.ConnectionPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost', // Provide a default if env var is missing
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // For local dev / self-signed certs
    enableArithAbort: true
  },
  pool: {
    max: 20, // Increase from 10 to 20
    min: 5,  // Increase from 0 to 5 to keep connections ready
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 15000, // Add timeout setting
  requestTimeout: 30000     // Add request timeout
});

// Connect to database
async function connectDB() {
  try {
    if (pool.connected) {
      console.log('Already connected to database');
      return;
    }
    
    // Check if environment variables are set
    if (!process.env.DB_SERVER) {
      console.error('ERROR: DB_SERVER environment variable is not set');
      console.log('Please check your .env file or environment configuration');
      process.exit(1); // Exit with error code
    }
    
    await pool.connect();
    console.log('Connected to MSSQL database successfully');
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.log('Connection details (without password):', {
      user: process.env.DB_USER,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME
    });
    
    // Retry connection after delay
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

const queryCache = {
  cache: {},
  
  // Get cached result
  get(key) {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if cache is expired
    if (item.expiry < Date.now()) {
      delete this.cache[key];
      return null;
    }
    
    return item.data;
  },
  
  // Set cache with TTL (time to live in ms)
  set(key, data, ttl = 60000) { // Default 1 minute TTL
    this.cache[key] = {
      data,
      expiry: Date.now() + ttl
    };
  },
  
  // Clear specific cache or all cache
  clear(key) {
    if (key) {
      delete this.cache[key];
    } else {
      this.cache = {};
    }
  }
};

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

async function cachedQuery(sqlQuery, params = [], cacheKey = null, ttl = 60000) {
  // Generate cache key if not provided
  if (!cacheKey) {
    cacheKey = sqlQuery + (params ? JSON.stringify(params) : '');
  }
  
  // Try to get from cache first
  const cachedResult = queryCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }
  
  // If not in cache, execute query
  try {
    let request = pool.request();
    
    // Add parameters if any
    if (params && Array.isArray(params)) {
      params.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
    }
    
    const result = await request.query(sqlQuery);
    
    // Cache the result
    queryCache.set(cacheKey, result, ttl);
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Admin dashboard functions

// Function to clear relevant caches when data changes
function clearRelevantCaches(type, id = null) {
  switch (type) {
    case 'category':
      queryCache.clear('categories_with_counts');
      if (id) queryCache.clear(`products_category_${id}`);
      break;
    case 'product':
      if (id) {
        queryCache.clear(`product_${id}`);
        // Also clear category cache this product belongs to
        // This would require knowing the category ID, which we don't have here
        // So we clear all category-related caches
        queryCache.clear('categories_with_counts');
      }
      break;
    case 'order':
      if (id) queryCache.clear(`order_${id}`);
      queryCache.clear('recent_orders');
      break;
    case 'all':
      queryCache.clear();
      break;
  }
}

// Get dashboard statistics
async function getDashboardStats() {
  try {
    // Get total revenue - using SoLuong * Gia from ChiTietDonHang instead of ThanhTien
    const totalRevenueResult = await pool.request().query(`
      SELECT ISNULL(SUM(c.SoLuong * c.Gia), 0) AS total 
      FROM DonHang d
      JOIN ChiTietDonHang c ON d.IDDonHang = c.IDDonHang
      WHERE d.TrangThai != 'Huy'
    `);
    
    // Get monthly revenue - using SoLuong * Gia from ChiTietDonHang instead of ThanhTien
    const monthlyRevenueResult = await pool.request().query(`
      SELECT ISNULL(SUM(c.SoLuong * c.Gia), 0) AS total 
      FROM DonHang d
      JOIN ChiTietDonHang c ON d.IDDonHang = c.IDDonHang
      WHERE MONTH(d.NgayDatHang) = MONTH(GETDATE()) 
      AND YEAR(d.NgayDatHang) = YEAR(GETDATE())
      AND d.TrangThai != 'Huy'
    `);
    
    // Get total orders
    const totalOrdersResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM DonHang
    `);
    
    // Get pending orders
    const pendingOrdersResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM DonHang
      WHERE TrangThai = 'ChoXuLy'
    `);
    
    // Get total products
    const totalProductsResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM QuanLySanPham
    `);
    
    // Get total users
    const totalUsersResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM TaiKhoan
      WHERE VaiTro = 'NguoiDung'
    `);
    
    return {
      totalRevenue: totalRevenueResult.recordset[0].total,
      monthlyRevenue: monthlyRevenueResult.recordset[0].total,
      totalOrders: totalOrdersResult.recordset[0].total,
      pendingOrders: pendingOrdersResult.recordset[0].total,
      totalProducts: totalProductsResult.recordset[0].total,
      totalUsers: totalUsersResult.recordset[0].total
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
}

// Get recent orders for dashboard
// Get recent orders for dashboard
// Get recent orders for dashboard
async function getRecentOrders(limit = 5) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT d.*, 
               t.TenNguoiDung as TenKhachHang,
               (SELECT SUM(c.SoLuong * c.Gia) 
                FROM ChiTietDonHang c 
                WHERE c.IDDonHang = d.IDDonHang) as TongTien
        FROM DonHang d
        LEFT JOIN TaiKhoan t ON d.IDTaiKhoan = t.IDTaiKhoan
        ORDER BY d.NgayDatHang DESC
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
// Get sales data for chart
async function getSalesData(period = 'month') {
  try {
    let query = '';
    
    if (period === 'week') {
      // Last 7 days - using SoLuong * Gia from ChiTietDonHang instead of ThanhTien
      query = `
        SELECT 
          CONVERT(VARCHAR(10), DATEADD(DAY, -numbers.number, GETDATE()), 120) AS date,
          ISNULL(SUM(c.SoLuong * c.Gia), 0) AS total
        FROM 
          (SELECT 0 AS number UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) AS numbers
        LEFT JOIN 
          DonHang d ON CONVERT(DATE, d.NgayDatHang) = CONVERT(DATE, DATEADD(DAY, -numbers.number, GETDATE()))
          AND d.TrangThai != 'Huy'
        LEFT JOIN
          ChiTietDonHang c ON d.IDDonHang = c.IDDonHang
        GROUP BY 
          DATEADD(DAY, -numbers.number, GETDATE())
        ORDER BY 
          date ASC
      `;
    } else if (period === 'month') {
      // Last 30 days - using SoLuong * Gia from ChiTietDonHang instead of ThanhTien
      query = `
        SELECT 
          DATEPART(DAY, d.NgayDatHang) AS day,
          ISNULL(SUM(c.SoLuong * c.Gia), 0) AS total
        FROM 
          DonHang d
        JOIN
          ChiTietDonHang c ON d.IDDonHang = c.IDDonHang
        WHERE 
          d.NgayDatHang >= DATEADD(DAY, -30, GETDATE())
          AND d.TrangThai != 'Huy'
        GROUP BY 
          DATEPART(DAY, d.NgayDatHang)
        ORDER BY 
          day ASC
      `;
    } else if (period === 'year') {
      // Last 12 months - using SoLuong * Gia from ChiTietDonHang instead of ThanhTien
      query = `
        SELECT 
          DATEPART(MONTH, d.NgayDatHang) AS month,
          ISNULL(SUM(c.SoLuong * c.Gia), 0) AS total
        FROM 
          DonHang d
        JOIN
          ChiTietDonHang c ON d.IDDonHang = c.IDDonHang
        WHERE 
          d.NgayDatHang >= DATEADD(MONTH, -12, GETDATE())
          AND d.TrangThai != 'Huy'
        GROUP BY 
          DATEPART(MONTH, d.NgayDatHang)
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
    
    // Add sorting
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
    
    // Count total users for pagination
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

// Add or update this function in your db.js file
async function getUserById(id) {
  try {
    console.log(`Getting user with ID: ${id}`);
    
    // Ensure the pool is connected
    if (!pool.connected) {
      await pool.connect();
    }
    
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('SELECT * FROM TaiKhoan WHERE IDTaiKhoan = @id');
    
    if (result.recordset.length === 0) {
      console.log(`No user found with ID: ${id}`);
      return null;
    }
    
    console.log(`User found: ${result.recordset[0].TenNguoiDung}`);
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

// Make sure to export the function
module.exports = {
  // ... your other exports
  getUserById,
  // ... your other exports
};

async function getUsers(options = {}) {
  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const search = options.search || '';
    const role = options.role || '';
    const sort = options.sort || 'name';
    
    let orderBy = 'TenNguoiDung ASC'; // Default sort by name
    
    if (sort === 'newest') {
      orderBy = 'NgayTao DESC';
    } else if (sort === 'oldest') {
      orderBy = 'NgayTao ASC';
    }
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause += " WHERE (TenNguoiDung LIKE @search OR Email LIKE @search)";
      params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }
    
    if (role) {
      whereClause += whereClause ? " AND VaiTro = @role" : " WHERE VaiTro = @role";
      params.push({ name: 'role', type: sql.NVarChar, value: role });
    }
    
    // Count total users for pagination
    let countQuery = `SELECT COUNT(*) AS total FROM TaiKhoan${whereClause}`;
    let request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const totalUsers = countResult.recordset[0].total;
    
    // Get users with pagination
    let query = `
      SELECT * FROM TaiKhoan${whereClause}
      ORDER BY ${orderBy}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return {
      users: result.recordset,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

async function getUserByEmail(email) {
  try {
    const request = pool.request()
      .input('email', sql.NVarChar, email);
    
    const result = await request.query(`
      SELECT * FROM TaiKhoan WHERE Email = @email
    `);
    
    return result.recordset[0] || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
}

// Add new user (admin function)
async function addUser(userData) {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Insert the new user into the database
    const result = await pool.request()
      .input('fullName', sql.NVarChar, userData.fullName)
      .input('email', sql.NVarChar, userData.email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, userData.role)
      .query(`
        INSERT INTO TaiKhoan (TenNguoiDung, Email, MatKhau, VaiTro, NgayTao)
        VALUES (@fullName, @email, @password, @role, GETDATE());
        SELECT SCOPE_IDENTITY() AS IDTaiKhoan;
      `);
    
    // Return the ID of the newly created user
    return result.recordset[0].IDTaiKhoan;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}


// Update user


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
    const result = await pool.request()
      .query('SELECT * FROM QuanLyDanhMuc ORDER BY TenDanhMuc');
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

// Add category
async function addCategory(categoryData) {
  try {
    const { name, imageUrl } = categoryData;
    
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('imageUrl', sql.NVarChar, imageUrl || '')
      .query(`
        INSERT INTO QuanLyDanhMuc (TenDanhMuc, HinhAnhSanPham)
        VALUES (@name, @imageUrl);
        
        SELECT SCOPE_IDENTITY() AS categoryId;
      `);
    
    return result.recordset[0].categoryId;
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
}


// Update category
async function updateCategory(categoryId, categoryData) {
  try {
    const { name, imageUrl } = categoryData;
    
    await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .input('name', sql.NVarChar, name)
      .input('imageUrl', sql.NVarChar, imageUrl || '')
      .query(`
        UPDATE QuanLyDanhMuc
        SET 
          TenDanhMuc = @name,
          HinhAnhSanPham = @imageUrl
        WHERE IDDanhMuc = @categoryId
      `);
    
    return true;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

// Delete category
async function deleteCategory(categoryId) {
  try {
    // Check if there are products in this category
    const productsResult = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query(`
        SELECT COUNT(*) AS count
        FROM QuanLySanPham
        WHERE IDDanhMuc = @categoryId
      `);
    
    if (productsResult.recordset[0].count > 0) {
      throw new Error('Cannot delete category with associated products');
    }
    
    await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query('DELETE FROM QuanLyDanhMuc WHERE IDDanhMuc = @categoryId');
    
    return true;
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
        LEFT JOIN TaiKhoan t ON d.IDTaiKhoan = t.IDTaiKhoan
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

async function logAction({ userId, action, description, entityType, entityId, oldData = null, newData = null, ipAddress = null }) {
  try {
    const pool = await sql.connect(config);
    
    // Get user name if userId is provided
    let userName = 'System';
    if (userId) {
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT TenNguoiDung FROM TaiKhoan WHERE IDTaiKhoan = @userId');
      
      if (userResult.recordset.length > 0) {
        userName = userResult.recordset[0].TenNguoiDung;
      }
    }
    
    // Insert audit log entry
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('userName', sql.NVarChar, userName)
      .input('action', sql.NVarChar, action)
      .input('description', sql.NVarChar, description)
      .input('entityType', sql.NVarChar, entityType)
      .input('entityId', sql.Int, entityId)
      .input('oldData', sql.NVarChar, oldData)
      .input('newData', sql.NVarChar, newData)
      .input('ipAddress', sql.NVarChar, ipAddress)
      .query(`
        INSERT INTO AuditLog (
          IDTaiKhoan, TenNguoiDung, HanhDong, MoTa, 
          LoaiDoiTuong, IDDoiTuong, ThoiGian, 
          DiaChiIP, DuLieuCu, DuLieuMoi
        ) VALUES (
          @userId, @userName, @action, @description, 
          @entityType, @entityId, GETDATE(), 
          @ipAddress, @oldData, @newData
        )
      `);
    
    return true;
  } catch (error) {
    console.error('Error logging action:', error);
    // Don't throw the error to prevent disrupting the main operation
    return false;
  }
}

// Update order status
async function updateOrderStatus(orderId, status) {
  try {
    const pool = await sql.connect(config);
    
    // Update the query to remove NgayCapNhat column reference
    const result = await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE DonHang 
        SET TrangThai = @status
        WHERE IDDonHang = @orderId
      `);
    
    // Log the action to audit log
    await logAction({
      userId: null, // This should be replaced with actual user ID from session
      action: 'UPDATE',
      description: `Cập nhật trạng thái đơn hàng #${orderId} thành ${status}`,
      entityType: 'Order',
      entityId: orderId,
      oldData: JSON.stringify({ TrangThai: 'previous_status' }), // Ideally, get the previous status
      newData: JSON.stringify({ TrangThai: status })
    });
    
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

// Add new function to get products by category
// Optimize the getProductsByCategory function with caching
async function getProductsByCategory(categoryId) {
  const cacheKey = `products_category_${categoryId}`;
  
  try {
    // Try to get from cache first (cache for 2 minutes)
    const cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query(`
        SELECT 
          p.IDSanPham, 
          p.TenSanPham, 
          p.Gia, 
          p.MoTa, 
          p.IDDanhMuc, 
          p.HinhAnhSanPham, 
          p.DonViBan,
          c.TenDanhMuc AS CategoryName
        FROM QuanLySanPham p
        LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        WHERE p.IDDanhMuc = @categoryId
        ORDER BY p.TenSanPham ASC
      `);
    
    // Cache the result for 2 minutes
    queryCache.set(cacheKey, result.recordset, 120000);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting products by category:', error);
    throw error;
  }
}

async function getProducts(options = {}) {
  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const search = options.search || '';
    const category = options.category || '';
    const sort = options.sort || 'name';
    
    let orderBy = 'p.TenSanPham ASC'; // Default sort by name
    
    if (sort === 'price_high') {
      orderBy = 'p.Gia DESC';
    } else if (sort === 'price_low') {
      orderBy = 'p.Gia ASC';
    } else if (sort === 'newest') {
      orderBy = 'p.IDSanPham DESC';
    }
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause += " WHERE (p.TenSanPham LIKE @search OR p.MoTa LIKE @search)";
      params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }
    
    if (category) {
      whereClause += whereClause ? " AND p.IDDanhMuc = @category" : " WHERE p.IDDanhMuc = @category";
      params.push({ name: 'category', type: sql.Int, value: category });
    }
    
    // Count total products for pagination
    let countQuery = `
      SELECT COUNT(*) AS total 
      FROM QuanLySanPham p
      ${whereClause}
    `;
    
    let request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const totalProducts = countResult.recordset[0].total;
    
    // Get products with pagination
    let query = `
      SELECT 
        p.IDSanPham, 
        p.TenSanPham, 
        p.Gia, 
        p.MoTa, 
        p.IDDanhMuc, 
        p.HinhAnhSanPham, 
        p.DonViBan,
        c.TenDanhMuc AS CategoryName
      FROM QuanLySanPham p
      LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
      ${whereClause}
      ORDER BY ${orderBy}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return {
      products: result.recordset,
      pagination: {
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Error getting products:', error);
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
// Optimize the getProductById function with caching
async function getProductById(productId) {
  const cacheKey = `product_${productId}`;
  
  try {
    // Try to get from cache first (cache for 2 minutes)
    const cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT 
          p.*,
          c.TenDanhMuc,
          k.SoLuongTon
        FROM QuanLySanPham p
        LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
        WHERE p.IDSanPham = @productId
      `);
    
    // Cache the result for 2 minutes
    queryCache.set(cacheKey, result.recordset[0], 120000);
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting product by ID:', error);
    throw error;
  }
}

async function updateUser(userId, userData) {
  try {
    let query = `
      UPDATE TaiKhoan
      SET TenNguoiDung = @fullName,
          Email = @email,
          VaiTro = @role
    `;
    
    // Only update password if provided
    if (userData.password) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      query += `, MatKhau = @password`;
    }
    
    query += ` WHERE IDTaiKhoan = @userId`;
    
    const request = pool.request()
      .input('userId', sql.Int, userId)
      .input('fullName', sql.NVarChar, userData.fullName)
      .input('email', sql.NVarChar, userData.email)
      .input('role', sql.NVarChar, userData.role);
    
    if (userData.password) {
      request.input('password', sql.NVarChar, await bcrypt.hash(userData.password, 10));
    }
    
    await request.query(query);
    
    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}


// Make sure to export the function
module.exports = {
  // ... your other exports
  getUserById,
  updateUser,
  // ... your other exports
};

// Add the missing addProduct function
async function addProduct(productData) {
  try {
    const result = await pool.request()
      .input('name', sql.NVarChar, productData.name)
      .input('price', sql.Money, productData.price)
      .input('description', sql.NVarChar, productData.description)
      .input('categoryId', sql.Int, productData.categoryId)
      .input('imageUrl', sql.NVarChar, productData.imageUrl)
      .input('unit', sql.NVarChar, productData.unit)
      .query(`
        INSERT INTO QuanLySanPham (TenSanPham, Gia, MoTa, IDDanhMuc, HinhAnhSanPham, DonViBan)
        VALUES (@name, @price, @description, @categoryId, @imageUrl, @unit);
        SELECT SCOPE_IDENTITY() AS IDSanPham;
      `);
    
    // Clear relevant caches
    clearRelevantCaches('category', productData.categoryId);
    
    // Return the ID of the newly created product
    return result.recordset[0].IDSanPham;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

// Add the missing updateProduct function
async function updateProduct(productId, productData) {
  try {
    // Get the current product to know its category
    const currentProduct = await getProductById(productId);
    
    await pool.request()
      .input('productId', sql.Int, productId)
      .input('name', sql.NVarChar, productData.name)
      .input('price', sql.Money, productData.price)
      .input('description', sql.NVarChar, productData.description)
      .input('categoryId', sql.Int, productData.categoryId)
      .input('imageUrl', sql.NVarChar, productData.imageUrl)
      .input('unit', sql.NVarChar, productData.unit)
      .query(`
        UPDATE QuanLySanPham
        SET TenSanPham = @name,
            Gia = @price,
            MoTa = @description,
            IDDanhMuc = @categoryId,
            HinhAnhSanPham = @imageUrl,
            DonViBan = @unit
        WHERE IDSanPham = @productId
      `);
    
    // Clear relevant caches
    clearRelevantCaches('product', productId);
    
    // If category changed, clear old and new category caches
    if (currentProduct && currentProduct.IDDanhMuc !== productData.categoryId) {
      clearRelevantCaches('category', currentProduct.IDDanhMuc);
      clearRelevantCaches('category', productData.categoryId);
    } else {
      clearRelevantCaches('category', productData.categoryId);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

// Add the missing deleteProduct function
async function deleteProduct(productId) {
  const transaction = new sql.Transaction(pool);
  
  try {
    // Get the current product to know its category
    const currentProduct = await getProductById(productId);
    
    await transaction.begin();
    
    // First, delete related inventory records
    await transaction.request()
      .input('productId', sql.Int, productId)
      .query('DELETE FROM QuanLyKhoHang WHERE IDSanPham = @productId');
    
    // Then, delete related order details if any
    await transaction.request()
      .input('productId', sql.Int, productId)
      .query('DELETE FROM ChiTietDonHang WHERE IDSanPham = @productId');
    
    // Finally, delete the product
    const result = await transaction.request()
      .input('productId', sql.Int, productId)
      .query('DELETE FROM QuanLySanPham WHERE IDSanPham = @productId');
    
    await transaction.commit();
    
    // Clear relevant caches
    clearRelevantCaches('product', productId);
    if (currentProduct) {
      clearRelevantCaches('category', currentProduct.IDDanhMuc);
    }
    
    return result;
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting product:', error);
    throw error;
  }
}

async function getAllOrders(page = 1, pageSize = 10, status = '', search = '') {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT d.*, t.TenNguoiDung as TenKhachHang
      FROM DonHang d
      LEFT JOIN TaiKhoan t ON d.IDTaiKhoan = t.IDTaiKhoan
      WHERE 1=1
    `;
    
    if (status) {
      query += ` AND d.TrangThai = @status`;
    }
    
    if (search) {
      query += ` AND (t.TenNguoiDung LIKE @search OR CAST(d.IDDonHang AS NVARCHAR) LIKE @search)`;
    }
    
    query += `
      ORDER BY d.NgayDatHang DESC
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
    
    // Count total orders - Fixed JOIN condition here
    let countQuery = `
      SELECT COUNT(*) AS total FROM DonHang d
      LEFT JOIN TaiKhoan t ON d.IDTaiKhoan = t.IDTaiKhoan
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

// Create new user (for signup)
// ... existing code ...

// Create a new user
async function createUser(userData) {
  try {
    const { firstName, lastName, email, password, provider, providerId } = userData;
    const fullName = `${firstName} ${lastName}`.trim();
    const currentDate = new Date();
    
    // Create a request with proper parameters
    const request = pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, password) // This will be null for OAuth users
      .input('role', sql.NVarChar, 'NguoiDung')
      .input('currentDate', sql.DateTime, currentDate)
      .input('provider', sql.NVarChar, provider || null)
      .input('providerId', sql.NVarChar, providerId || null);
    
    // SQL query to insert a new user - using @parameter syntax for SQL Server
    const query = `
      INSERT INTO TaiKhoan (TenNguoiDung, Email, MatKhau, VaiTro, NgayTao, Provider, ProviderId) 
      VALUES (@fullName, @email, @password, @role, @currentDate, @provider, @providerId);
      SELECT SCOPE_IDENTITY() AS IDTaiKhoan;
    `;
    
    const result = await request.query(query);
    
    // Get the newly created user ID
    const userId = result.recordset[0].IDTaiKhoan;
    
    // Return the complete user object
    return await getUserById(userId);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// ... existing code ...
// Add the missing searchProducts function
async function searchProducts(searchTerm) {
  try {
    // Create a request with proper parameters
    const request = pool.request()
      .input('searchTerm', sql.NVarChar, `%${searchTerm}%`);
    
    // SQL query to search products
    const query = `
      SELECT 
        p.IDSanPham, 
        p.TenSanPham, 
        p.Gia, 
        p.MoTa, 
        p.IDDanhMuc, 
        p.HinhAnhSanPham, 
        p.DonViBan,
        c.TenDanhMuc,
        k.SoLuongTon
      FROM QuanLySanPham p
      LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
      LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
      WHERE p.TenSanPham LIKE @searchTerm
      OR p.MoTa LIKE @searchTerm
      OR c.TenDanhMuc LIKE @searchTerm
      ORDER BY p.TenSanPham
    `;
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}

async function getOrders(options = {}) {
  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const search = options.search || '';
    const status = options.status || '';
    const sort = options.sort || 'newest';
    
    let orderBy = 'o.NgayDatHang DESC'; // Default sort by newest
    
    if (sort === 'oldest') {
      orderBy = 'o.NgayDatHang ASC';
    }
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause += " WHERE (t.TenNguoiDung LIKE @search OR t.Email LIKE @search OR CAST(o.IDDonHang AS NVARCHAR) LIKE @search)";
      params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }
    
    if (status) {
      whereClause += whereClause ? " AND o.TrangThai = @status" : " WHERE o.TrangThai = @status";
      params.push({ name: 'status', type: sql.NVarChar, value: status });
    }
    
    // Count total orders for pagination
    let countQuery = `
      SELECT COUNT(*) AS total 
      FROM DonHang o
      JOIN TaiKhoan t ON o.IDTaiKhoan = t.IDTaiKhoan
      ${whereClause}
    `;
    
    let request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const totalOrders = countResult.recordset[0].total;
    
    // Get orders with pagination
    let query = `
      SELECT 
        o.IDDonHang, 
        o.IDTaiKhoan, 
        o.NgayDatHang, 
        o.TrangThai,
        t.TenNguoiDung,
        t.Email,
        (SELECT SUM(c.SoLuong * c.Gia) FROM ChiTietDonHang c WHERE c.IDDonHang = o.IDDonHang) AS TongTien,
        (SELECT COUNT(*) FROM ChiTietDonHang c WHERE c.IDDonHang = o.IDDonHang) AS SoLuongSanPham
      FROM DonHang o
      JOIN TaiKhoan t ON o.IDTaiKhoan = t.IDTaiKhoan
      ${whereClause}
      ORDER BY ${orderBy}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return {
      orders: result.recordset,
      pagination: {
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Error getting orders:', error);
    throw error;
  }
}

async function getOrderById(orderId) {
  try {
    // Get order header information
    const orderResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT 
          o.IDDonHang, 
          o.IDTaiKhoan, 
          o.NgayDatHang, 
          o.TrangThai,
          t.TenNguoiDung,
          t.Email
        FROM DonHang o
        JOIN TaiKhoan t ON o.IDTaiKhoan = t.IDTaiKhoan
        WHERE o.IDDonHang = @orderId
      `);
    
    if (orderResult.recordset.length === 0) {
      return null;
    }
    
    const order = orderResult.recordset[0];
    
    // Get order details (items)
    const detailsResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT 
          c.IDChiTietDonHang,
          c.IDSanPham,
          c.SoLuong,
          c.Gia,
          p.TenSanPham,
          p.HinhAnhSanPham,
          p.DonViBan
        FROM ChiTietDonHang c
        JOIN QuanLySanPham p ON c.IDSanPham = p.IDSanPham
        WHERE c.IDDonHang = @orderId
      `);
    
    // Calculate total
    const totalResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT SUM(SoLuong * Gia) AS TongTien
        FROM ChiTietDonHang
        WHERE IDDonHang = @orderId
      `);
    
    // Add details and total to order object
    order.items = detailsResult.recordset;
    order.TongTien = totalResult.recordset[0].TongTien || 0;
    
    return order;
  } catch (error) {
    console.error('Error getting order by ID:', error);
    throw error;
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    // Validate status
    const validStatuses = ['ChoXuLy', 'DangGiao', 'HoanThanh', 'Huy'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid order status');
    }
    
    await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('status', sql.NVarChar, status)
      .query('UPDATE DonHang SET TrangThai = @status WHERE IDDonHang = @orderId');
    
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

async function getCategories(options = {}) {
  try {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const search = options.search || '';
    const sort = options.sort || 'name';
    
    let orderBy = 'TenDanhMuc ASC'; // Default sort by name
    
    if (sort === 'newest') {
      orderBy = 'IDDanhMuc DESC';
    } else if (sort === 'oldest') {
      orderBy = 'IDDanhMuc ASC';
    }
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause = " WHERE TenDanhMuc LIKE @search";
      params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }
    
    // Count total categories for pagination
    let countQuery = `
      SELECT COUNT(*) AS total 
      FROM QuanLyDanhMuc
      ${whereClause}
    `;
    
    let request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const totalCategories = countResult.recordset[0].total;
    
    // Get categories with pagination
    let query = `
      SELECT 
        IDDanhMuc,
        TenDanhMuc,
        HinhAnhSanPham as HinhAnhDanhMuc
      FROM QuanLyDanhMuc
      ${whereClause}
      ORDER BY ${orderBy}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    request = pool.request();
    
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    
    return {
      categories: result.recordset,
      pagination: {
        totalCategories,
        totalPages: Math.ceil(totalCategories / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

async function getCategoryById(categoryId) {
  try {
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query(`
        SELECT 
          IDDanhMuc,
          TenDanhMuc,
          HinhAnhSanPham as HinhAnhDanhMuc
        FROM QuanLyDanhMuc
        WHERE IDDanhMuc = @categoryId
      `);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting category by ID:', error);
    throw error;
  }
}

async function getTopSellingProducts(limit = 10) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          p.IDSanPham,
          p.TenSanPham,
          p.HinhAnhSanPham,
          SUM(c.SoLuong) AS TotalQuantity,
          SUM(c.SoLuong * c.Gia) AS TotalRevenue
        FROM ChiTietDonHang c
        JOIN QuanLySanPham p ON c.IDSanPham = p.IDSanPham
        JOIN DonHang d ON c.IDDonHang = d.IDDonHang
        WHERE d.TrangThai != 'Huy'
        GROUP BY p.IDSanPham, p.TenSanPham, p.HinhAnhSanPham
        ORDER BY TotalQuantity DESC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting top selling products:', error);
    // Return empty array as fallback
    return [];
  }
}

async function getSalesByCategory() {
  try {
    const result = await pool.request()
      .query(`
        SELECT 
          c.IDDanhMuc,
          c.TenDanhMuc,
          COUNT(DISTINCT d.IDDonHang) AS OrderCount,
          SUM(ct.SoLuong) AS TotalQuantity,
          SUM(ct.SoLuong * ct.Gia) AS TotalRevenue
        FROM QuanLyDanhMuc c
        LEFT JOIN QuanLySanPham p ON c.IDDanhMuc = p.IDDanhMuc
        LEFT JOIN ChiTietDonHang ct ON p.IDSanPham = ct.IDSanPham
        LEFT JOIN DonHang d ON ct.IDDonHang = d.IDDonHang AND d.TrangThai != 'Huy'
        GROUP BY c.IDDanhMuc, c.TenDanhMuc
        ORDER BY TotalRevenue DESC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting sales by category:', error);
    // Return empty array as fallback
    return [];
  }
}

// Add this function to get audit logs with filtering and pagination
// Add this function to get audit logs with filtering and pagination
async function getAuditLogs({ page = 1, limit = 20, userId = '', action = '', entityType = '', startDate = '', endDate = '' }) {
  try {
    const pool = await sql.connect(config);
    
    // Build the WHERE clause based on filters
    let whereClause = '';
    const conditions = [];
    
    if (userId) {
      conditions.push(`IDTaiKhoan = ${userId}`);
    }
    
    if (action) {
      conditions.push(`HanhDong = '${action}'`);
    }
    
    if (entityType) {
      conditions.push(`LoaiDoiTuong = '${entityType}'`);
    }
    
    if (startDate) {
      conditions.push(`ThoiGian >= '${startDate}'`);
    }
    
    if (endDate) {
      // Add one day to include the end date fully
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const formattedNextDay = nextDay.toISOString().split('T')[0];
      conditions.push(`ThoiGian < '${formattedNextDay}'`);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    // Count total records for pagination
    const countResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM AuditLog ${whereClause}
    `);
    
    const totalItems = countResult.recordset[0].total;
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;
    
    // Get paginated logs - Fix column alias and pagination syntax
    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT 
          IDAuditLog,
          TenNguoiDung as userName,
          HanhDong as action,
          MoTa as description,
          LoaiDoiTuong as entityType,
          IDDoiTuong as entityId,
          ThoiGian as timestamp,
          DiaChiIP as ipAddress,
          DuLieuCu as oldData,
          DuLieuMoi as newData
        FROM AuditLog
        ${whereClause}
        ORDER BY ThoiGian DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    return {
      logs: result.recordset,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Database error in getAuditLogs:', error);
    throw error;
  }
}

async function getBestSellingProducts(limit = 10) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT 
          p.IDSanPham,
          p.TenSanPham,
          p.Gia,
          p.MoTa,
          p.HinhAnhSanPham,
          p.DonViBan,
          c.TenDanhMuc,
          c.IDDanhMuc,
          SUM(cd.SoLuong) AS TotalSold,
          k.SoLuongTon
        FROM QuanLySanPham p
        JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        JOIN ChiTietDonHang cd ON p.IDSanPham = cd.IDSanPham
        JOIN DonHang d ON cd.IDDonHang = d.IDDonHang
        LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
        WHERE d.TrangThai != 'Huy'
        GROUP BY 
          p.IDSanPham, 
          p.TenSanPham, 
          p.Gia, 
          p.MoTa, 
          p.HinhAnhSanPham, 
          p.DonViBan, 
          c.TenDanhMuc,
          c.IDDanhMuc,
          k.SoLuongTon
        ORDER BY TotalSold DESC
        OFFSET 0 ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting best selling products:', error);
    throw error;
  }
}

async function createOrder(orderData) {
  try {
      // Start a transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      
      try {
          // Insert into DonHang table
          const orderResult = await transaction.request()
              .input('IDTaiKhoan', sql.Int, orderData.userId || null)
              .input('NgayDatHang', sql.DateTime, new Date())
              .input('TrangThai', sql.NVarChar, 'ChoXuLy')
              .query(`
                  INSERT INTO DonHang (IDTaiKhoan, NgayDatHang, TrangThai)
                  OUTPUT INSERTED.IDDonHang
                  VALUES (@IDTaiKhoan, @NgayDatHang, @TrangThai)
              `);
          
          const orderId = orderResult.recordset[0].IDDonHang;
          
          // Insert order items into ChiTietDonHang table
          for (const item of orderData.items) {
              await transaction.request()
                  .input('IDDonHang', sql.Int, orderId)
                  .input('IDSanPham', sql.Int, item.id)
                  .input('SoLuong', sql.Int, item.quantity)
                  .input('Gia', sql.Decimal(10, 2), item.price)
                  .query(`
                      INSERT INTO ChiTietDonHang (IDDonHang, IDSanPham, SoLuong, Gia)
                      VALUES (@IDDonHang, @IDSanPham, @SoLuong, @Gia)
                  `);
              
              // Update inventory
              await transaction.request()
                  .input('IDSanPham', sql.Int, item.id)
                  .input('SoLuong', sql.Int, item.quantity)
                  .query(`
                      UPDATE QuanLyKhoHang
                      SET SoLuongTon = SoLuongTon - @SoLuong
                      WHERE IDSanPham = @IDSanPham
                  `);
          }
          
          // Insert payment information
          await transaction.request()
              .input('IDDonHang', sql.Int, orderId)
              .input('PhuongThucThanhToan', sql.NVarChar, orderData.paymentMethod)
              .input('TrangThaiThanhToan', sql.NVarChar, orderData.paymentMethod === 'TienMat' ? 'ChuaThanhToan' : 'DaThanhToan')
              .input('NgayThanhToan', sql.DateTime, orderData.paymentMethod === 'TienMat' ? null : new Date())
              .query(`
                  INSERT INTO ThanhToan (IDDonHang, PhuongThucThanhToan, TrangThaiThanhToan, NgayThanhToan)
                  VALUES (@IDDonHang, @PhuongThucThanhToan, @TrangThaiThanhToan, @NgayThanhToan)
              `);
          
          // Commit the transaction
          await transaction.commit();
          
          return orderId;
      } catch (error) {
          // If there's an error, roll back the transaction
          await transaction.rollback();
          throw error;
      }
  } catch (error) {
      console.error('Error creating order:', error);
      throw error;
  }
}

async function getCategoriesWithProductCounts() {
  const cacheKey = 'categories_with_counts';
  
  try {
    // Try to get from cache first (cache for 5 minutes)
    const cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    const result = await pool.request().query(`
      SELECT c.IDDanhMuc, c.TenDanhMuc, c.HinhAnhSanPham, 
             COUNT(p.IDSanPham) AS ProductCount
      FROM QuanLyDanhMuc c
      LEFT JOIN QuanLySanPham p ON c.IDDanhMuc = p.IDDanhMuc
      GROUP BY c.IDDanhMuc, c.TenDanhMuc, c.HinhAnhSanPham
      ORDER BY c.TenDanhMuc
    `);
    
    // Cache the result for 5 minutes
    queryCache.set(cacheKey, result.recordset, 300000);
    
    return result.recordset;
  } catch (error) {
    console.error('Error getting categories with product counts:', error);
    throw error;
  }
}

// Add this function to log all admin actions
async function logAdminAction(userId, action, description, entityType, entityId) {
  try {
    const pool = await sql.connect(config);
    const timestamp = new Date().toISOString();
    
    // Get user information
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT TenNguoiDung, Email FROM TaiKhoan WHERE IDTaiKhoan = @userId');
    
    const user = userResult.recordset[0];
    const userName = user ? user.TenNguoiDung : 'Unknown User';
    
    // Insert into audit log table
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('userName', sql.NVarChar, userName)
      .input('action', sql.VarChar, action)
      .input('description', sql.NVarChar, description)
      .input('entityType', sql.VarChar, entityType)
      .input('entityId', sql.Int, entityId)
      .input('timestamp', sql.DateTime, timestamp)
      .input('ipAddress', sql.VarChar, '0.0.0.0') // In a real app, capture the IP
      .query(`
        INSERT INTO AuditLog (IDTaiKhoan, TenNguoiDung, HanhDong, MoTa, LoaiDoiTuong, IDDoiTuong, ThoiGian, DiaChiIP)
        VALUES (@userId, @userName, @action, @description, @entityType, @entityId, @timestamp, @ipAddress)
      `);
      
    console.log(`Audit log created: ${action} by ${userName}`);
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}

// Add this function to get recent audit logs
async function getRecentAuditLogs(limit = 10) {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) 
          a.IDAuditLog,
          a.TenNguoiDung as user,
          a.HanhDong as action,
          a.MoTa as description,
          a.LoaiDoiTuong as entityType,
          a.IDDoiTuong as entityId,
          a.ThoiGian as timestamp
        FROM AuditLog a
        ORDER BY a.ThoiGian DESC
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}

// Add this function to get all audit logs with pagination
async function getAllAuditLogs(page = 1, limit = 20, filters = {}) {
  try {
    const pool = await sql.connect(config);
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        a.IDAuditLog,
        a.TenNguoiDung as user,
        a.HanhDong as action,
        a.MoTa as description,
        a.LoaiDoiTuong as entityType,
        a.IDDoiTuong as entityId,
        a.ThoiGian as timestamp,
        a.DiaChiIP as ipAddress
      FROM AuditLog a
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Add filters
    if (filters.userId) {
      query += ` AND a.IDTaiKhoan = @userId`;
      queryParams.push({ name: 'userId', type: sql.Int, value: filters.userId });
    }
    
    if (filters.action) {
      query += ` AND a.HanhDong = @action`;
      queryParams.push({ name: 'action', type: sql.VarChar, value: filters.action });
    }
    
    if (filters.entityType) {
      query += ` AND a.LoaiDoiTuong = @entityType`;
      queryParams.push({ name: 'entityType', type: sql.VarChar, value: filters.entityType });
    }
    
    if (filters.startDate && filters.endDate) {
      query += ` AND a.ThoiGian BETWEEN @startDate AND @endDate`;
      queryParams.push({ name: 'startDate', type: sql.DateTime, value: new Date(filters.startDate) });
      queryParams.push({ name: 'endDate', type: sql.DateTime, value: new Date(filters.endDate) });
    }
    
    // Count total records
    const countQuery = query.replace('SELECT \n        a.IDAuditLog,\n        a.TenNguoiDung as user,\n        a.HanhDong as action,\n        a.MoTa as description,\n        a.LoaiDoiTuong as entityType,\n        a.IDDoiTuong as entityId,\n        a.ThoiGian as timestamp,\n        a.DiaChiIP as ipAddress', 'SELECT COUNT(*) as total');
    
    let request = pool.request();
    queryParams.forEach(param => {
      request = request.input(param.name, param.type, param.value);
    });
    
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;
    
    // Add pagination
    query += ` ORDER BY a.ThoiGian DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    
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

// Modify the existing functions to include audit logging
// For example, update the updateProduct function:

async function updateProduct(productId, productData, userId) {
  try {
    // First get the original product data for audit purposes
    const originalProduct = await getProductById(productId);
    
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('id', sql.Int, productId)
      .input('name', sql.NVarChar, productData.TenSanPham)
      .input('price', sql.Money, productData.Gia)
      .input('description', sql.NVarChar, productData.MoTa)
      .input('categoryId', sql.Int, productData.IDDanhMuc)
      .input('image', sql.NVarChar, productData.HinhAnhSanPham)
      .input('unit', sql.NVarChar, productData.DonViBan)
      .query(`
        UPDATE QuanLySanPham
        SET TenSanPham = @name,
            Gia = @price,
            MoTa = @description,
            IDDanhMuc = @categoryId,
            HinhAnhSanPham = @image,
            DonViBan = @unit
        WHERE IDSanPham = @id
      `);
      
    // Log the action
        // Log the action
  const changes = [];
  if (originalProduct.TenSanPham !== productData.TenSanPham) 
    changes.push(`Tên: ${originalProduct.TenSanPham} → ${productData.TenSanPham}`);
  if (originalProduct.Gia !== productData.Gia)
    changes.push(`Giá: ${originalProduct.Gia} → ${productData.Gia}`);
  if (originalProduct.MoTa !== productData.MoTa)
    changes.push(`Mô tả đã được cập nhật`);
  if (originalProduct.IDDanhMuc !== productData.IDDanhMuc)
    changes.push(`Danh mục: ${originalProduct.IDDanhMuc} → ${productData.IDDanhMuc}`);
  if (originalProduct.HinhAnhSanPham !== productData.HinhAnhSanPham)
    changes.push(`Hình ảnh đã được cập nhật`);
  if (originalProduct.DonViBan !== productData.DonViBan)
    changes.push(`Đơn vị bán: ${originalProduct.DonViBan} → ${productData.DonViBan}`);
  
  const description = `Cập nhật sản phẩm: ${productData.TenSanPham}. Thay đổi: ${changes.join(', ')}`;
  
  // Log to audit trail
  await logAdminAction(
    userId, 
    'UPDATE', 
    description, 
    'Product', 
    productId,
    originalProduct,  // Old data
    productData       // New data
  );
  
  return result.rowsAffected[0] > 0;
} catch (error) {
  console.error('Error updating product:', error);
  return false;
}
}

// Add audit logging to createProduct function
async function createProduct(productData, userId) {
try {
  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('name', sql.NVarChar, productData.TenSanPham)
    .input('price', sql.Money, productData.Gia)
    .input('description', sql.NVarChar, productData.MoTa)
    .input('categoryId', sql.Int, productData.IDDanhMuc)
    .input('image', sql.NVarChar, productData.HinhAnhSanPham)
    .input('unit', sql.NVarChar, productData.DonViBan)
    .input('costPrice', sql.Money, productData.GiaGoc || productData.Gia * 0.7) // Default cost price if not provided
    .query(`
      INSERT INTO QuanLySanPham (TenSanPham, Gia, MoTa, IDDanhMuc, HinhAnhSanPham, DonViBan, GiaGoc)
      OUTPUT INSERTED.IDSanPham
      VALUES (@name, @price, @description, @categoryId, @image, @unit, @costPrice)
    `);
  
  const productId = result.recordset[0].IDSanPham;
  
  // Log the action
  const description = `Tạo sản phẩm mới: ${productData.TenSanPham}`;
  
  // Log to audit trail
  await logAdminAction(
    userId, 
    'CREATE', 
    description, 
    'Product', 
    productId,
    null,         // No old data for creation
    productData   // New data
  );
  
  return productId;
} catch (error) {
  console.error('Error creating product:', error);
  return null;
}
}

// Add audit logging to deleteProduct function
async function deleteProduct(productId, userId) {
try {
  // First get the product data for audit purposes
  const product = await getProductById(productId);
  if (!product) {
    return false;
  }
  
  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('id', sql.Int, productId)
    .query(`
      DELETE FROM QuanLySanPham
      WHERE IDSanPham = @id
    `);
  
  // Log the action
  const description = `Xóa sản phẩm: ${product.TenSanPham}`;
  
  // Log to audit trail
  await logAdminAction(
    userId, 
    'DELETE', 
    description, 
    'Product', 
    productId,
    product,  // Old data
    null      // No new data for deletion
  );
  
  return result.rowsAffected[0] > 0;
} catch (error) {
  console.error('Error deleting product:', error);
  return false;
}
}

// Add audit logging to user management functions
async function updateUser(userId, userData, adminId) {
try {
  // First get the original user data for audit purposes
  const originalUser = await getUserById(userId);
  
  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('id', sql.Int, userId)
    .input('name', sql.NVarChar, userData.TenNguoiDung)
    .input('email', sql.NVarChar, userData.Email)
    .input('phone', sql.VarChar, userData.SoDienThoai)
    .input('address', sql.NVarChar, userData.DiaChi)
    .input('role', sql.VarChar, userData.VaiTro)
    .query(`
      UPDATE TaiKhoan
      SET TenNguoiDung = @name,
          Email = @email,
          SoDienThoai = @phone,
          DiaChi = @address,
          VaiTro = @role
      WHERE IDTaiKhoan = @id
    `);
  
  // Log the action
  const changes = [];
  if (originalUser.TenNguoiDung !== userData.TenNguoiDung)
    changes.push(`Tên: ${originalUser.TenNguoiDung} → ${userData.TenNguoiDung}`);
  if (originalUser.Email !== userData.Email)
    changes.push(`Email: ${originalUser.Email} → ${userData.Email}`);
  if (originalUser.SoDienThoai !== userData.SoDienThoai)
    changes.push(`SĐT: ${originalUser.SoDienThoai} → ${userData.SoDienThoai}`);
  if (originalUser.DiaChi !== userData.DiaChi)
    changes.push(`Địa chỉ đã được cập nhật`);
  if (originalUser.VaiTro !== userData.VaiTro)
    changes.push(`Vai trò: ${originalUser.VaiTro} → ${userData.VaiTro}`);
  
  // Create a sanitized version of user data without password
  const sanitizedOriginal = { ...originalUser };
  delete sanitizedOriginal.MatKhau;
  
  const sanitizedNew = { ...userData };
  delete sanitizedNew.MatKhau;
  
  const description = `Cập nhật người dùng: ${userData.TenNguoiDung}. Thay đổi: ${changes.join(', ')}`;
  
  // Log to audit trail
  await logAdminAction(
    adminId, 
    'UPDATE', 
    description, 
    'User', 
    userId,
    sanitizedOriginal,  // Old data (without password)
    sanitizedNew        // New data (without password)
  );
  
  return result.rowsAffected[0] > 0;
} catch (error) {
  console.error('Error updating user:', error);
  return false;
}
}

// Add audit logging to order management
// Find the updateOrderStatus function and modify it
// Modify the updateOrderStatus function to include userId parameter
// Update the updateOrderStatus function to accept userId parameter
async function updateOrderStatus(orderId, status, userId) {
  try {
    const pool = await sql.connect(config);
    
    // Get the current status before updating
    const currentStatusResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query('SELECT TrangThai FROM DonHang WHERE IDDonHang = @orderId');
    
    const oldStatus = currentStatusResult.recordset.length > 0 
      ? currentStatusResult.recordset[0].TrangThai 
      : 'Unknown';
    
    // Update the order status
    const result = await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE DonHang 
        SET TrangThai = @status
        WHERE IDDonHang = @orderId
      `);
    
    // Log the action to audit log
    await logAction({
      userId: userId, // Use the passed userId
      action: 'UPDATE',
      description: `Cập nhật trạng thái đơn hàng #${orderId} từ ${oldStatus} thành ${status}`,
      entityType: 'Order',
      entityId: orderId,
      oldData: JSON.stringify({ TrangThai: oldStatus }),
      newData: JSON.stringify({ TrangThai: status })
    });
    
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

// Add audit logging to category management
async function createCategory(categoryData, adminId) {
try {
  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('name', sql.NVarChar, categoryData.TenDanhMuc)
    .input('description', sql.NVarChar, categoryData.MoTa)
    .query(`
      INSERT INTO DanhMucSanPham (TenDanhMuc, MoTa)
      OUTPUT INSERTED.IDDanhMuc
      VALUES (@name, @description)
    `);
  
  const categoryId = result.recordset[0].IDDanhMuc;
  
  // Log the action
  const description = `Tạo danh mục mới: ${categoryData.TenDanhMuc}`;
  
  // Log to audit trail
  await logAdminAction(
    adminId, 
    'CREATE', 
    description, 
    'Category', 
    categoryId,
    null,           // No old data for creation
    categoryData    // New data
  );
  
  return categoryId;
} catch (error) {
  console.error('Error creating category:', error);
  return null;
}
}

// Add audit logging to login/logout events
async function logUserLogin(userId, ipAddress) {
try {
  const user = await getUserById(userId);
  const description = `Đăng nhập thành công`;
  
  // Log to audit trail
  await logAdminAction(
    userId, 
    'LOGIN', 
    description, 
    'User', 
    userId,
    null,  // No old data for login
    { timestamp: new Date().toISOString(), ipAddress }  // Login metadata
  );
  
  return true;
} catch (error) {
  console.error('Error logging user login:', error);
  return false;
}
}

async function logUserLogout(userId, ipAddress) {
try {
  const user = await getUserById(userId);
  const description = `Đăng xuất thành công`;
  
  // Log to audit trail
  await logAdminAction(
    userId, 
    'LOGOUT', 
    description, 
    'User', 
    userId,
    null,  // No old data for logout
    { timestamp: new Date().toISOString(), ipAddress }  // Logout metadata
  );
  
  return true;
} catch (error) {
  console.error('Error logging user logout:', error);
  return false;
}
}

// Enhanced version of logAdminAction that captures IP address from request
async function logAdminActionWithRequest(userId, action, description, entityType, entityId, oldData, newData, req) {
try {
  // Get IP address from request
  const ipAddress = req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress || 
                    req.connection.socket.remoteAddress || 
                    '0.0.0.0';
  
  const pool = await sql.connect(config);
  const timestamp = new Date().toISOString();
  
  // Get user information
  const userResult = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT TenNguoiDung, Email FROM TaiKhoan WHERE IDTaiKhoan = @userId');
  
  const user = userResult.recordset[0];
  const userName = user ? user.TenNguoiDung : 'Unknown User';
  
  // Convert data to strings if provided
  const oldDataStr = oldData ? JSON.stringify(oldData) : null;
  const newDataStr = newData ? JSON.stringify(newData) : null;
  
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
    .input('oldData', sql.NVarChar, oldDataStr)
    .input('newData', sql.NVarChar, newDataStr)
    .query(`
      INSERT INTO AuditLog (IDTaiKhoan, TenNguoiDung, HanhDong, MoTa, LoaiDoiTuong, IDDoiTuong, ThoiGian, DiaChiIP, DuLieuCu, DuLieuMoi)
      VALUES (@userId, @userName, @action, @description, @entityType, @entityId, @timestamp, @ipAddress, @oldData, @newData)
    `);
    
  console.log(`Audit log created: ${action} by ${userName} from ${ipAddress}`);
  return true;
} catch (error) {
  console.error('Error creating audit log:', error);
  return false;
}
}

// Update the module exports to include the new function
module.exports = {
  query,
  connectDB,
  getDashboardStats,
  getRecentOrders,
  getLowStockProducts,
  getSalesData,
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
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
  updateOrderStatus,
  getProductsByCategory,
  searchProducts,
  getUsers,
  getProducts,
  getOrders,
  getOrderById,
  getCategories,
  getCategoryById,
  getTopSellingProducts,
  getSalesByCategory,
  getBestSellingProducts,
  createOrder,
  getCategoriesWithProductCounts,
  cachedQuery,
  clearRelevantCaches,
  queryCache,
  logAdminAction,
  logAdminActionWithRequest,
  getRecentAuditLogs,
  getAllAuditLogs,
  updateProduct,
  createProduct,
  deleteProduct,
  updateUser,
  updateOrderStatus,
  createCategory,
  logUserLogin,
  logUserLogout,
  getAuditLogs,
  logAction
};
