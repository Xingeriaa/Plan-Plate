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
async function updateOrderStatus(orderId, status, adminId) {
  try {
    // First get the original order data for audit purposes
    const originalOrder = await getOrderById(orderId);
    
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('id', sql.Int, orderId)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE DonHang
        SET TrangThai = @status,
            NgayCapNhat = GETDATE()
        WHERE IDDonHang = @id
      `);
    
    // Log the action
    const description = `Cập nhật trạng thái đơn hàng #${orderId}: ${originalOrder.TrangThai} → ${status}`;
    
    // Create order data with updated status
    const updatedOrder = { ...originalOrder, TrangThai: status };
    
    // Log to audit trail
    await logAdminAction(
      adminId, 
      'UPDATE', 
      description, 
      'Order', 
      orderId,
      originalOrder,  // Old data
      updatedOrder    // New data
    );
    
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error('Error updating order status:', error);
    return false;
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

module.exports = {
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
  logUserLogout
};