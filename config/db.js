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
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM TaiKhoan WHERE Email = @email');
    
    return result.recordset[0];
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

// Add new function to get products by category
async function getProductsByCategory(categoryId) {
  try {
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
async function getProductById(productId) {
  try {
    const result = await pool.request()
      .input('productId', sql.Int, productId)
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
        WHERE p.IDSanPham = @productId
      `);
    
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
    
    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

// Add the missing deleteProduct function
async function deleteProduct(productId) {
  try {
    await pool.request()
      .input('productId', sql.Int, productId)
      .query('DELETE FROM QuanLySanPham WHERE IDSanPham = @productId');
    
    return true;
  } catch (error) {
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
async function createUser(userData) {
  try {
    const { firstName, lastName, email, password } = userData;
    const fullName = `${firstName} ${lastName}`.trim();
    
    const result = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, password)
      .input('role', sql.NVarChar, 'NguoiDung')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO TaiKhoan (TenNguoiDung, Email, MatKhau, VaiTro, NgayTao)
        VALUES (@fullName, @email, @password, @role, @createdAt)
        
        SELECT SCOPE_IDENTITY() AS id
      `);
    
    const userId = result.recordset[0].id;
    return await getUserById(userId);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Add the missing searchProducts function
async function searchProducts(query) {
  try {
    const result = await pool.request()
      .input('query', sql.NVarChar, `%${query}%`)
      .query(`
        SELECT p.*, c.TenDanhMuc, k.SoLuongTon
        FROM QuanLySanPham p
        LEFT JOIN QuanLyDanhMuc c ON p.IDDanhMuc = c.IDDanhMuc
        LEFT JOIN QuanLyKhoHang k ON p.IDSanPham = k.IDSanPham
        WHERE p.TenSanPham LIKE @query 
           OR p.MoTa LIKE @query
           OR c.TenDanhMuc LIKE @query
        ORDER BY p.TenSanPham
      `);
    
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
  getSalesByCategory
};
