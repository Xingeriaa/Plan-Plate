const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/auth');

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
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      name: req.adminUser.TenNguoiDung,
      stats,
      recentOrders,
      lowStockProducts,
      salesData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the dashboard.',
      error: { status: 500 }
    });
  }
});

// Users management
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const role = req.query.role || '';
    
    const result = await db.getAllUsers(page, 10, search, role);
    
    res.render('admin/users', {
      title: 'User Management',
      users: result.users,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total
      },
      search,
      role
    });
  } catch (error) {
    console.error('Users management error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading users.',
      error: { status: 500 }
    });
  }
});

// Get user by ID (for editing)
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new user
router.post('/users/add', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    
    // Validate input
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if email already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    // Add user
    await db.addUser({ fullName, email, password, role });
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while adding the user.',
      error: { status: 500 }
    });
  }
});

// Update user
router.post('/users/update', async (req, res) => {
  try {
    const { userId, fullName, email, password, role } = req.body;
    
    // Validate input
    if (!userId || !fullName || !email) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Update user
    await db.updateUser(userId, { fullName, email, password, role });
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while updating the user.',
      error: { status: 500 }
    });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if trying to delete self
    if (userId === req.adminUser.IDTaiKhoan) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await db.deleteUser(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Products management
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const filter = req.query.filter || '';
    
    let result;
    if (filter === 'low-stock') {
      // Get all low stock products
      const lowStockProducts = await db.getLowStockProducts(100);
      result = {
        products: lowStockProducts,
        page: 1,
        totalPages: 1,
        total: lowStockProducts.length
      };
    } else {
      result = await db.getAllProducts(page, 10);
    }
    
    // Get categories for product form
    const categories = await db.getAllCategories();
    
    res.render('admin/products', {
      title: 'Product Management',
      products: result.products,
      categories,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total
      },
      filter
    });
  } catch (error) {
    console.error('Products management error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading products.',
      error: { status: 500 }
    });
  }
});

// Add new product
router.post('/products/add', async (req, res) => {
  try {
    const { productName, categoryId, price, stock, imageUrl, unit, description } = req.body;
    
    // Validate input
    if (!productName || !categoryId || !price) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Add product
    await db.addProduct({
      productName,
      categoryId: parseInt(categoryId),
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      imageUrl,
      unit,
      description
    });
    
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while adding the product.',
      error: { status: 500 }
    });
  }
});

// Get product by ID (for editing)
router.get('/products/edit/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await db.getProductById(productId);
    
    if (!product) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Product not found',
        error: { status: 404 }
      });
    }
    
    // Get categories for product form
    const categories = await db.getAllCategories();
    
    res.render('admin/edit-product', {
      title: 'Edit Product',
      product,
      categories
    });
  } catch (error) {
    console.error('Edit product error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the product.',
      error: { status: 500 }
    });
  }
});

// Update product
router.post('/products/update', async (req, res) => {
  try {
    const { productId, productName, categoryId, price, stock, imageUrl, unit, description } = req.body;
    
    // Validate input
    if (!productId || !productName || !categoryId || !price) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Update product
    await db.updateProduct(parseInt(productId), {
      productName,
      categoryId: parseInt(categoryId),
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      imageUrl,
      unit,
      description
    });
    
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while updating the product.',
      error: { status: 500 }
    });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    await db.deleteProduct(productId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Orders management
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const status = req.query.status || null;
    
    const result = await db.getAllOrders(status, page, 10);
    
    res.render('admin/orders', {
      title: 'Order Management',
      orders: result.orders,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total
      },
      status
    });
  } catch (error) {
    console.error('Orders management error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading orders.',
      error: { status: 500 }
    });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const orderDetails = await db.getOrderWithItems(orderId);
    
    res.json(orderDetails);
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    await db.updateOrderStatus(orderId, status);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Categories management
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.getAllCategories();
    
    res.render('admin/categories', {
      title: 'Category Management',
      categories
    });
  } catch (error) {
    console.error('Categories management error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading categories.',
      error: { status: 500 }
    });
  }
});

// Add category
router.post('/categories/add', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    await db.addCategory({ name, description });
    
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while adding the category.',
      error: { status: 500 }
    });
  }
});

// Update category
router.post('/categories/update', async (req, res) => {
  try {
    const { categoryId, name, description } = req.body;
    
    if (!categoryId || !name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    await db.updateCategory(parseInt(categoryId), { name, description });
    
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while updating the category.',
      error: { status: 500 }
    });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    await db.deleteCategory(categoryId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Reports
router.get('/reports', async (req, res) => {
  try {
    const reportType = req.query.type || 'sales';
    const period = req.query.period || 'month';
    
    let reportData = {};
    
    if (reportType === 'sales') {
      reportData = await db.getSalesData(period);
    } else if (reportType === 'products') {
      reportData = await db.getTopProducts(10);
    } else if (reportType === 'customers') {
      reportData = await db.getTopCustomers(10);
    }
    
    res.render('admin/reports', {
      title: 'Reports',
      reportType,
      period,
      reportData
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while generating the report.',
      error: { status: 500 }
    });
  }
});

// Generate report
router.get('/reports/generate', async (req, res) => {
  try {
    const reportType = req.query.type || 'sales';
    const format = req.query.format || 'pdf';
    
    // Logic to generate and download report would go here
    // This is a placeholder for now
    
    res.send('Report generation not implemented yet');
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while generating the report.',
      error: { status: 500 }
    });
  }
});

module.exports = router;