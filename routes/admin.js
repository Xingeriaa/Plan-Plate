const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const auditLogService = require('../services/auditLogService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/images/products'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
  }
});

// Apply admin middleware to all routes
router.use(isAdmin);

// Dashboard
router.get('/', async (req, res) => {
  try {
    // Get dashboard statistics
    const stats = await db.getDashboardStats();
    
    // Get recent orders
    const recentOrders = await db.getRecentOrders(5);
    
    // Get low stock products
    const lowStockProducts = await db.getLowStockProducts(5);
    
    // Get sales data for chart
    const salesData = await db.getSalesData('month');
    
    // Get recent audit logs
    const auditLogs = await db.getRecentAuditLogs(5);
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats,
      recentOrders,
      lowStockProducts,
      salesData,
      auditLogs
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading dashboard data',
      error
    });
  }
});

// Users Management
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    const { users, totalUsers } = await db.getUsers(page, limit, search);
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.render('admin/users', {
      title: 'User Management',
      user: req.user,
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      search
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading users',
      error
    });
  }
});

// Add new user
router.post('/users', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    
    // Validate input
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Check if email already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    
    // Add user
    const userId = await db.addUser({
      fullName,
      email,
      password,
      role: role || 'NguoiDung'
    });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'CREATE',
      `Created new user: ${fullName} (${email})`,
      'user',
      userId,
      null,
      { fullName, email, role },
      req.ip
    );
    
    res.status(201).json({ success: true, message: 'User created successfully', userId });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
});

// Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error getting user details:', error);
    res.status(500).json({ success: false, message: 'Error getting user details' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, email, role, password } = req.body;
    
    // Get original user data for audit log
    const originalUser = await db.getUserById(userId);
    if (!originalUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user
    await db.updateUser(userId, { fullName, email, role, password });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'UPDATE',
      `Updated user: ${fullName} (${email})`,
      'user',
      userId,
      { fullName: originalUser.TenNguoiDung, email: originalUser.Email, role: originalUser.VaiTro },
      { fullName, email, role },
      req.ip
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get original user data for audit log
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Prevent deleting yourself
    if (user.IDTaiKhoan === req.user.IDTaiKhoan) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    
    // Delete user
    await db.deleteUser(userId);
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'DELETE',
      `Deleted user: ${user.TenNguoiDung} (${user.Email})`,
      'user',
      userId,
      { fullName: user.TenNguoiDung, email: user.Email, role: user.VaiTro },
      null,
      req.ip
    );
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// Products Management
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const filter = req.query.filter || '';
    
    const { products, totalProducts } = await db.getProducts(page, limit, search, category, filter);
    const categories = await db.getAllCategories();
    const totalPages = Math.ceil(totalProducts / limit);
    
    res.render('admin/products', {
      title: 'Product Management',
      user: req.user,
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      search,
      category,
      filter
    });
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading products',
      error
    });
  }
});

// Add new product
router.post('/products', upload.single('productImage'), async (req, res) => {
  try {
    const { 
      name, description, price, categoryId, 
      unit, stockQuantity, nutritionInfo, ingredients 
    } = req.body;
    
    // Validate input
    if (!name || !price || !categoryId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Process image path
    let imagePath = null;
    if (req.file) {
      imagePath = `/images/products/${req.file.filename}`;
    }
    
    // Add product
    const productId = await db.addProduct({
      name,
      description,
      price: parseFloat(price),
      categoryId: parseInt(categoryId),
      unit,
      stockQuantity: parseInt(stockQuantity) || 0,
      nutritionInfo,
      ingredients,
      imagePath
    });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'CREATE',
      `Created new product: ${name}`,
      'product',
      productId,
      null,
      { name, price, categoryId },
      req.ip
    );
    
    res.status(201).json({ success: true, message: 'Product created successfully', productId });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creating product' });
  }
});

// Get product details
router.get('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await db.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error getting product details:', error);
    res.status(500).json({ success: false, message: 'Error getting product details' });
  }
});

// Update product
router.put('/products/:id', upload.single('productImage'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { 
      name, description, price, categoryId, 
      unit, stockQuantity, nutritionInfo, ingredients 
    } = req.body;
    
    // Get original product data for audit log
    const originalProduct = await db.getProductById(productId);
    if (!originalProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Process image path
    let imagePath = originalProduct.HinhAnhSanPham;
    if (req.file) {
      imagePath = `/images/products/${req.file.filename}`;
    }
    
    // Update product
    await db.updateProduct(productId, {
      name,
      description,
      price: parseFloat(price),
      categoryId: parseInt(categoryId),
      unit,
      stockQuantity: parseInt(stockQuantity),
      nutritionInfo,
      ingredients,
      imagePath
    });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'UPDATE',
      `Updated product: ${name}`,
      'product',
      productId,
      {
        name: originalProduct.TenSanPham,
        price: originalProduct.Gia,
        categoryId: originalProduct.IDDanhMuc
      },
      { name, price, categoryId },
      req.ip
    );
    
    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Get original product data for audit log
    const product = await db.getProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Delete product
    await db.deleteProduct(productId);
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'DELETE',
      `Deleted product: ${product.TenSanPham}`,
      'product',
      productId,
      {
        name: product.TenSanPham,
        price: product.Gia,
        categoryId: product.IDDanhMuc
      },
      null,
      req.ip
    );
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

// Categories Management
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.getCategoriesWithProductCounts();
    
    res.render('admin/categories', {
      title: 'Category Management',
      user: req.user,
      categories
    });
  } catch (error) {
    console.error('Error loading categories:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading categories',
      error
    });
  }
});

// Add new category
router.post('/categories', upload.single('categoryImage'), async (req, res) => {
  try {
    const { name } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    // Process image path
    let imagePath = null;
    if (req.file) {
      imagePath = `/images/categories/${req.file.filename}`;
    }
    
    // Add category
    const categoryId = await db.addCategory({
      name,
      imagePath
    });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'CREATE',
      `Created new category: ${name}`,
      'category',
      categoryId,
      null,
      { name },
      req.ip
    );
    
    res.status(201).json({ success: true, message: 'Category created successfully', categoryId });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: 'Error creating category' });
  }
});

// Update category
router.put('/categories/:id', upload.single('categoryImage'), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name } = req.body;
    
    // Get original category data for audit log
    const originalCategory = await db.getCategoryById(categoryId);
    if (!originalCategory) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Process image path
    let imagePath = originalCategory.HinhAnhSanPham;
    if (req.file) {
      imagePath = `/images/categories/${req.file.filename}`;
    }
    
    // Update category
    await db.updateCategory(categoryId, {
      name,
      imagePath
    });
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'UPDATE',
      `Updated category: ${name}`,
      'category',
      categoryId,
      { name: originalCategory.TenDanhMuc },
      { name },
      req.ip
    );
    
    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Error updating category' });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Get original category data for audit log
    const category = await db.getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Check if category has products
    const productsCount = await db.getProductCountByCategory(categoryId);
    if (productsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${productsCount} products. Please reassign or delete the products first.` 
      });
    }
    
    // Delete category
    await db.deleteCategory(categoryId);
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'DELETE',
      `Deleted category: ${category.TenDanhMuc}`,
      'category',
      categoryId,
      { name: category.TenDanhMuc },
      null,
      req.ip
    );
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Error deleting category' });
  }
});

// Orders Management
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const dateRange = req.query.dateRange || '';
    
    const { orders, totalOrders } = await db.getOrders(page, limit, search, status, dateRange);
    const totalPages = Math.ceil(totalOrders / limit);
    
    res.render('admin/orders', {
      title: 'Order Management',
      user: req.user,
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      search,
      status,
      dateRange
    });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading orders',
      error
    });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await db.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Order not found',
        error: { status: 404 }
      });
    }
    
    const orderItems = await db.getOrderItems(orderId);
    const shippingInfo = await db.getOrderShippingInfo(orderId);
    const paymentInfo = await db.getOrderPaymentInfo(orderId);
    
    res.render('admin/order-detail', {
      title: `Order #${orderId}`,
      user: req.user,
      order,
      orderItems,
      shippingInfo,
      paymentInfo
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error getting order details',
      error
    });
  }
});

// Update order status
router.post('/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    // Get original order data for audit log
    const originalOrder = await db.getOrderById(orderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Update order status
    await db.updateOrderStatus(orderId, status);
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'UPDATE',
      `Updated order #${orderId} status from ${originalOrder.TrangThai} to ${status}`,
      'order',
      orderId,
      { status: originalOrder.TrangThai },
      { status },
      req.ip
    );
    
    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Error updating order status' });
  }
});

// Reports
router.get('/reports', async (req, res) => {
  try {
    const reportType = req.query.type || 'sales';
    const period = req.query.period || 'month';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    
    let reportData = {};
    
    switch (reportType) {
      case 'sales':
        reportData = await db.getSalesReport(period, startDate, endDate);
        break;
      case 'products':
        reportData = await db.getProductsReport(period, startDate, endDate);
        break;
      case 'customers':
        reportData = await db.getCustomersReport(period, startDate, endDate);
        break;
      case 'inventory':
        reportData = await db.getInventoryReport();
        break;
      default:
        reportData = await db.getSalesReport(period, startDate, endDate);
    }
    
    res.render('admin/reports', {
      title: 'Reports',
      user: req.user,
      reportType,
      period,
      startDate,
      endDate,
      reportData
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error generating report',
      error
    });
  }
});

// Export report
router.get('/reports/export', async (req, res) => {
  try {
    const reportType = req.query.type || 'sales';
    const period = req.query.period || 'month';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const format = req.query.format || 'csv';
    
    let reportData = {};
    
    switch (reportType) {
      case 'sales':
        reportData = await db.getSalesReport(period, startDate, endDate);
        break;
      case 'products':
        reportData = await db.getProductsReport(period, startDate, endDate);
        break;
      case 'customers':
        reportData = await db.getCustomersReport(period, startDate, endDate);
        break;
      case 'inventory':
        reportData = await db.getInventoryReport();
        break;
      default:
        reportData = await db.getSalesReport(period, startDate, endDate);
    }
    
    // Log action
    await auditLogService.logAction(
      req.user.IDTaiKhoan,
      'EXPORT',
      `Exported ${reportType} report in ${format} format`,
      'report',
      0,
      null,
      { reportType, period, startDate, endDate, format },
      req.ip
    );
    
    // Generate and send file based on format
    if (format === 'csv') {
      // Generate CSV
      const csv = await db.generateReportCSV(reportData, reportType);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else if (format === 'pdf') {
      // Generate PDF
      const pdfBuffer = await db.generateReportPDF(reportData, reportType);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`);
      res.send(pdfBuffer);
    } else {
      res.status(400).json({ success: false, message: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ success: false, message: 'Error exporting report' });
  }
});

// Audit Logs
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const action = req.query.action || '';
    const entityType = req.query.entityType || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    
    const { auditLogs, totalLogs } = await db.getAuditLogs(page, limit, search, action, entityType, startDate, endDate);
    const totalPages = Math.ceil(totalLogs / limit);
    
    res.render('admin/audit-logs', {
      title: 'Audit Logs',
      user: req.user,
      auditLogs,
      currentPage: page,
      totalPages,
      totalLogs,
      search,
      action,
      entityType,
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error loading audit logs:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Error loading audit logs',
      error
    });
  }
});

// Get audit log details
router.get('/audit-logs/:id', async (req, res) => {
  try {
    const logId = req.params.id;
    const log = await db.getAuditLogById(logId);
    
    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }
    
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error getting audit log details:', error);
    res.status(500).json({ success: false, message: 'Error getting audit log details' });
  }
});

module.exports = router;