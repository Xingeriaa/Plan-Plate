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

// Connect to database
async function connectDB() {
  try {
    await sql.connect(config);
    console.log('Connected to MSSQL database');
  } catch (err) {
    console.error('Database connection error:', err);
    // Retry connection after delay
    setTimeout(connectDB, 5000);
  }
}

// Initialize connection
connectDB();

// User-related database operations
const db = {
  // Get user by email
  async getUserByEmail(email) {
    try {
      const result = await sql.query`
        SELECT IDTaiKhoan, TenNguoiDung, Email, MatKhau, VaiTro, NgayTao 
        FROM TaiKhoan 
        WHERE Email = ${email}
      `;
      
      // Debug log (remove in production)
      if (result.recordset[0]) {
        console.log('User found, has password:', !!result.recordset[0].MatKhau);
      } else {
        console.log('No user found with email:', email);
      }
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(id) {
    try {
      const result = await sql.query`
        SELECT * FROM TaiKhoan 
        WHERE IDTaiKhoan = ${id}
      `;
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  },

  // Create new user
  async createUser(userData) {
    try {
      const result = await sql.query`
        INSERT INTO TaiKhoan (TenNguoiDung, Email, MatKhau, VaiTro, NgayTao)
        VALUES (${userData.firstName + ' ' + userData.lastName}, ${userData.email}, ${userData.password}, 'NguoiDung', ${new Date()})
        
        SELECT SCOPE_IDENTITY() AS id
      `;
      
      const userId = result.recordset[0].id;
      
      // Return the newly created user
      return {
        id: userId,
        username: userData.firstName + ' ' + userData.lastName,
        email: userData.email,
        role: 'NguoiDung',
        password: undefined // Don't return the password
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Get all users (with pagination)
  async getAllUsers(page = 1, pageSize = 10) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await sql.query`
        SELECT IDTaiKhoan, TenNguoiDung, Email, VaiTro, NgayTao
        FROM TaiKhoan
        ORDER BY IDTaiKhoan
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `;
      
      const countResult = await sql.query`
        SELECT COUNT(*) AS total FROM TaiKhoan
      `;
      
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
  },

  // Update user
  async updateUser(id, userData) {
    try {
      await sql.query`
        UPDATE TaiKhoan
        SET 
          TenNguoiDung = ${userData.username || null},
          Email = ${userData.email || null},
          ${userData.password ? `MatKhau = ${userData.password},` : ''}
          VaiTro = ${userData.role || null}
        WHERE IDTaiKhoan = ${id}
      `;
      
      return await this.getUserById(id);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(id) {
    try {
      await sql.query`
        DELETE FROM TaiKhoan
        WHERE IDTaiKhoan = ${id}
      `;
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};

module.exports = db;
