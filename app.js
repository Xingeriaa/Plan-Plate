const express = require('express');
const passport = require('passport');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const db = require('./config/db');
const sql = require('mssql');


dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
res.redirect('/profile');
});

app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
res.redirect('/profile');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const authRoutes = require('./routes/auth');

app.use('/', authRoutes);

app.get('/profile', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  res.render('profile', { 
    user: req.user,
    name: req.user.TenNguoiDung,
    email: req.user.Email,
    isAdmin: req.user.VaiTro === 'Admin'
  });
});

app.get('/api/products', async (req, res) => {
  try {
      const pool = await db.getPool();
      const result = await pool.request()
          .query(`
              SELECT s.*, k.SoLuongTon 
              FROM QuanLySanPham s
              LEFT JOIN QuanLyKhoHang k ON s.IDSanPham = k.IDSanPham
          `);
      
      res.json(result.recordset);
  } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
  }
});
// Remove the entire complex root route and replace with these separate routes

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for categories
app.get('/api/categories', async (req, res) => {
  try {
      const pool = await db.getPool();
      const result = await pool.request()
          .query('SELECT * FROM QuanLyDanhMuc');
      
      res.json(result.recordset);
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add search products API endpoint
app.get('/api/search', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        
        const products = await db.searchProducts(searchTerm);
        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Add these API endpoints after your existing API endpoints

// API endpoint for products by category
app.get('/api/products/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const products = await db.getProductsByCategory(categoryId);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// API endpoint for product details
app.get('/api/product/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await db.getProductById(productId);
        res.json(product);
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({ error: 'Failed to fetch product details' });
    }
});

// Find this route in your app.js file
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  // Remove the layout: false parameter
  res.render('login', { error: req.query.error });
});

app.get('/signup', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  // Remove the layout: false parameter
  res.render('signup', { error: req.query.error });
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/auth/github/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// In your Passport strategy setup
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      
      const isMatch = await bcrypt.compare(password, user.MatKhau);
      
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.IDTaiKhoan); // Make sure this matches your database column name
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.post('/login', (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  
  passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/login?error=Invalid credentials',
    failureFlash: false
  })(req, res, next);
});

app.post('/signup', async (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.redirect('/signup?error=Passwords do not match');
    }
    
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.redirect('/signup?error=Email already in use');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await db.createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });
    
    req.login(newUser, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.redirect('/login');
      }
      return res.redirect('/profile');
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/signup?error=Registration failed');
  }
});

// Add this after your existing middleware setup
// Admin access middleware
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.VaiTro === 'Admin') {
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Admin privileges required.' });
};

// Add these admin routes after your existing routes
// Update the admin dashboard route to include the required data
// Admin dashboard route

app.get('/admin', isAdmin, async (req, res) => {
  try {
    // Get dashboard stats
    const pool = await sql.connect(config);
    
    // User stats
    const userResult = await pool.request().query(`
      SELECT COUNT(*) as userCount,
      (SELECT COUNT(*) FROM TaiKhoan WHERE DATEDIFF(month, NgayTao, GETDATE()) = 0) as newUsers
      FROM TaiKhoan
    `);
    
    // Order stats
    const orderResult = await pool.request().query(`
      SELECT COUNT(*) as orderCount,
      (SELECT COUNT(*) FROM DonHang WHERE TrangThai = 'ChoXuLy') as pendingOrders,
      (SELECT SUM(cd.Gia * cd.SoLuong) FROM ChiTietDonHang cd) as totalRevenue,
      (SELECT SUM(cd.Gia * cd.SoLuong) 
       FROM ChiTietDonHang cd 
       JOIN DonHang dh ON cd.IDDonHang = dh.IDDonHang 
       WHERE DATEDIFF(month, dh.NgayDatHang, GETDATE()) = 0) as monthlyRevenue
      FROM DonHang
    `);
    
    // Product stats
    const productResult = await pool.request().query(`
      SELECT COUNT(*) as productCount,
      (SELECT COUNT(*) FROM QuanLyKhoHang WHERE SoLuongTon < 10) as lowStockCount
      FROM QuanLySanPham
    `);
    
    // Get recent orders
    const recentOrdersResult = await pool.request().query(`
      SELECT TOP 5 dh.IDDonHang, tk.TenNguoiDung as TenKhachHang, dh.NgayDatHang, 
      (SELECT SUM(cd.Gia * cd.SoLuong) FROM ChiTietDonHang cd WHERE cd.IDDonHang = dh.IDDonHang) as TongTien, 
      dh.TrangThai
      FROM DonHang dh
      JOIN TaiKhoan tk ON dh.IDTaiKhoan = tk.IDTaiKhoan
      ORDER BY dh.NgayDatHang DESC
    `);
    
    // Get low stock products
    const lowStockResult = await pool.request().query(`
      SELECT TOP 5 sp.IDSanPham, sp.TenSanPham, kh.SoLuongTon, sp.HinhAnhSanPham, dm.TenDanhMuc
      FROM QuanLySanPham sp
      JOIN QuanLyKhoHang kh ON sp.IDSanPham = kh.IDSanPham
      LEFT JOIN QuanLyDanhMuc dm ON sp.IDDanhMuc = dm.IDDanhMuc
      WHERE kh.SoLuongTon < 10
      ORDER BY kh.SoLuongTon ASC
    `);
    
    // Get sales data for chart
    const salesDataResult = await pool.request().query(`
      SELECT 
        CONVERT(date, dh.NgayDatHang) as OrderDate,
        SUM(cd.Gia * cd.SoLuong) as DailyRevenue
      FROM DonHang dh
      JOIN ChiTietDonHang cd ON dh.IDDonHang = cd.IDDonHang
      WHERE DATEDIFF(day, dh.NgayDatHang, GETDATE()) <= 30
      GROUP BY CONVERT(date, dh.NgayDatHang)
      ORDER BY OrderDate
    `);
    
        // Get recent audit logs
        const auditLogsResult = await pool.request().query(`
          SELECT TOP 5
            a.IDAuditLog,
            a.TenNguoiDung as userName,
            a.HanhDong as action,
            a.MoTa as description,
            a.LoaiDoiTuong as entityType,
            a.IDDoiTuong as entityId,
            a.ThoiGian as timestamp,
            a.DiaChiIP as ipAddress
          FROM AuditLog a
          ORDER BY a.ThoiGian DESC
        `);
    
    // Format sales data for chart
    const salesData = {
      labels: salesDataResult.recordset.map(item => {
        const date = new Date(item.OrderDate);
        return date.toLocaleDateString('vi-VN');
      }),
      values: salesDataResult.recordset.map(item => item.DailyRevenue || 0)
    };
    
    // Combine all stats
    const stats = {
      userCount: userResult.recordset[0].userCount || 0,
      newUsers: userResult.recordset[0].newUsers || 0,
      orderCount: orderResult.recordset[0].orderCount || 0,
      pendingOrders: orderResult.recordset[0].pendingOrders || 0,
      totalRevenue: orderResult.recordset[0].totalRevenue || 0,
      monthlyRevenue: orderResult.recordset[0].monthlyRevenue || 0,
      productCount: productResult.recordset[0].productCount || 0,
      lowStockCount: productResult.recordset[0].lowStockCount || 0
    };
    
    res.render('admin/dashboard', {
      stats,
      recentOrders: recentOrdersResult.recordset,
      lowStockProducts: lowStockResult.recordset,
      salesData,
      auditLogs: auditLogsResult.recordset // Add this line to pass audit logs to the template
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard data' });
  }
});

// Add these routes to your app.js file for product management

// Admin routes - Audit Logs
app.get('/admin/audit-logs', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const action = req.query.action || '';
    const entityType = req.query.entityType || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';
    
    // Create filters object for template
    const filters = {
      userId: req.query.userId || '',
      action,
      entityType,
      startDate: dateFrom,
      endDate: dateTo
    };
    
    const result = await db.getAuditLogs({
      page,
      limit: 20,
      search,
      action,
      entityType,
      dateFrom,
      dateTo
    });
    
    // Helper function to determine badge class based on action
    const getBadgeClass = (action) => {
      switch(action.toLowerCase()) {
        case 'create':
          return 'bg-success';
        case 'update':
          return 'bg-primary';
        case 'delete':
          return 'bg-danger';
        case 'login':
          return 'bg-info';
        case 'logout':
          return 'bg-secondary';
        default:
          return 'bg-dark';
      }
    };
    
    // Helper function to format date
    const formatDate = (dateString) => {
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      return new Date(dateString).toLocaleDateString('vi-VN', options);
    };
    
    res.render('admin/audit-logs', {
      logs: result.logs,
      pagination: {
        totalPages: result.pagination.totalPages,
        page: page
      },
      filters,
      getBadgeClass,
      formatDate
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
});

// Admin routes - Product Management
app.get('/admin/products', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.redirect('/login');
    }
    
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'name';
    
    // Get products with pagination, search, category filter, and sorting
    const result = await db.getProducts({
      page,
      limit: 10,
      search,
      category,
      sort
    });
    
    // Get all categories for the filter dropdown
    const categories = await db.getAllCategories();
    
    res.render('admin/products', {
      products: result.products,
      pagination: result.pagination,
      categories,
      search,
      category,
      sort
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Route to get product by ID (for editing)
app.get('/admin/products/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const productId = req.params.id;
    const product = await db.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route to add a new product
app.post('/admin/products/add', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { name, price, description, categoryId, imageUrl, unit } = req.body;
    
    // Validate input
    if (!name || !price || !categoryId) {
      return res.status(400).render('error', { 
        message: 'Failed to add product',
        error: 'Name, price and category are required'
      });
    }
    
    // Add the product to the database
    await db.addProduct({
      name,
      price: parseFloat(price),
      description: description || '',
      categoryId: parseInt(categoryId),
      imageUrl: imageUrl || '',
      unit: unit || ''
    });
    
    // Redirect back to the products page
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).render('error', { 
      message: 'Failed to add product',
      error: error.message
    });
  }
});

// Route to update a product
app.post('/admin/products/update', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { productId, name, price, description, categoryId, imageUrl, unit } = req.body;
    
    // Validate input
    if (!productId || !name || !price || !categoryId) {
      return res.status(400).render('error', { 
        message: 'Failed to update product',
        error: 'Required fields are missing'
      });
    }
    
    // Update the product in the database
    await db.updateProduct(productId, {
      name,
      price: parseFloat(price),
      description: description || '',
      categoryId: parseInt(categoryId),
      imageUrl: imageUrl || '',
      unit: unit || ''
    });
    
    // Redirect back to the products page
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).render('error', { 
      message: 'Failed to update product',
      error: error.message
    });
  }
});

// Route to delete a product
app.delete('/admin/products/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const productId = req.params.id;
    
    // Check if product exists
    const product = await db.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Delete the product from the database
    await db.deleteProduct(productId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add this route for the admin users page after your existing routes

// Admin routes - User Management
app.get('/admin/users', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.redirect('/login');
    }
    
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const sort = req.query.sort || 'name';
    
    const result = await db.getUsers({
      page,
      limit: 10,
      search,
      role,
      sort
    });
    
    res.render('admin/users', {
      users: result.users,
      pagination: result.pagination,
      search,
      role,
      sort
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Route to add a new user
app.post('/admin/users/add', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { name, email, password, role } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).render('error', { 
        message: 'Failed to add user',
        error: 'Name, email and password are required'
      });
    }
    
    // Add the user to the database
    await db.addUser({
      name,
      email,
      password,
      role: role || 'NguoiDung'
    });
    
    // Redirect back to the users page
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).render('error', { 
      message: 'Failed to add user',
      error: error.message
    });
  }
});

// Route to update a user
app.post('/admin/users/update', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { userId, name, email, role, password } = req.body;
    
    // Validate input
    if (!userId || !name || !email || !role) {
      return res.status(400).render('error', { 
        message: 'Failed to update user',
        error: 'Required fields are missing'
      });
    }
    
    // Update the user in the database
    await db.updateUser(userId, {
      name,
      email,
      role,
      password // This will be handled in the db function (only update if provided)
    });
    
    // Redirect back to the users page
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).render('error', { 
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Route to delete a user
app.delete('/admin/users/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userId = req.params.id;
    
    // Check if user exists
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete the user from the database
    await db.deleteUser(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add this route for the admin orders page after your existing admin routes

// Admin routes - Order Management
app.get('/admin/orders', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.redirect('/login');
    }
    
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'newest';
    
    const result = await db.getOrders({
      page,
      limit: 10,
      search,
      status,
      sort
    });
    
    res.render('admin/orders', {
      orders: result.orders,
      pagination: result.pagination,
      search,
      status,
      sort
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});


// Route to get order details
app.get('/admin/orders/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const orderId = req.params.id;
    const order = await db.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route to update order status
app.post('/admin/orders/update-status', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { orderId, status } = req.body;
    
    // Validate input
    if (!orderId || !status) {
      return res.status(400).render('error', { 
        message: 'Failed to update order status',
        error: 'Order ID and status are required'
      });
    }
    
    // Update the order status in the database
    await db.updateOrderStatus(orderId, status);
    
    // Redirect back to the orders page
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).render('error', { 
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Admin routes - Category Management
app.get('/admin/categories', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.redirect('/login');
    }
    
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const sort = req.query.sort || 'name';
    
    const result = await db.getCategories({
      page,
      limit: 10,
      search,
      sort
    });
    
    res.render('admin/categories', {
      categories: result.categories,
      pagination: result.pagination,
      search,
      sort
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Route to get category by ID (for editing)
app.get('/admin/categories/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const categoryId = req.params.id;
    const category = await db.getCategoryById(categoryId);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route to add a new category
app.post('/admin/categories/add', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { name, description, imageUrl } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).render('error', { 
        message: 'Failed to add category',
        error: 'Category name is required'
      });
    }
    
    // Add the category to the database
    await db.addCategory({
      name,
      description: description || '',
      imageUrl: imageUrl || ''
    });
    
    // Redirect back to the categories page
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).render('error', { 
      message: 'Failed to add category',
      error: error.message
    });
  }
});

// Route to update a category
app.post('/admin/categories/update', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { categoryId, name, description, imageUrl } = req.body;
    
    // Validate input
    if (!categoryId || !name) {
      return res.status(400).render('error', { 
        message: 'Failed to update category',
        error: 'Category ID and name are required'
      });
    }
    
    // Update the category in the database
    await db.updateCategory(categoryId, {
      name,
      description: description || '',
      imageUrl: imageUrl || ''
    });
    
    // Redirect back to the categories page
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).render('error', { 
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// Route to delete a category
app.delete('/admin/categories/:id', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.isAuthenticated() || req.user.VaiTro !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const categoryId = req.params.id;
    
    // Check if category exists
    const category = await db.getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Delete the category from the database
    await db.deleteCategory(categoryId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add the reports route to your app.js file:
app.get('/admin/reports', isAdmin, async (req, res) => {
  try {
    // Get sales data for different time periods
    const weekSales = await db.getSalesData('week');
    const monthSales = await db.getSalesData('month');
    const yearSales = await db.getSalesData('year');
    
    // Get top selling products
    const topProducts = await db.getTopSellingProducts(10);
    
    // Get sales by category
    const categorySales = await db.getSalesByCategory();
    
    res.render('admin/reports', { 
      user: req.user,
      weekSales,
      monthSales,
      yearSales,
      topProducts,
      categorySales
    });
  } catch (error) {
    console.error('Error loading reports page:', error);
    res.status(500).send('Error loading reports page');
  }
});

// Best Sellers page route
app.get('/bestsellers', async (req, res) => {
  try {
    const bestSellingProducts = await db.getBestSellingProducts(12);
    
    res.render('bestsellers', {
      title: 'Best Selling Products - PlannPlate',
      products: bestSellingProducts,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error loading best sellers page:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the best sellers page.',
      error: { status: 500 }
    });
  }
});

// Add this API endpoint for placing orders
app.post('/api/orders', async (req, res) => {
  try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'You must be logged in to place an order' });
      }
      
      const userId = req.user.IDTaiKhoan;
      const { items, subtotal, shipping, tax, total, paymentMethod, shippingInfo } = req.body;
      
      // Validate order data
      if (!items || !items.length) {
          return res.status(400).json({ error: 'No items in cart' });
      }
      
      if (!shippingInfo || !shippingInfo.email || !shippingInfo.phone || !shippingInfo.firstName || 
          !shippingInfo.lastName || !shippingInfo.address || !shippingInfo.city || 
          !shippingInfo.province || !shippingInfo.postalCode || !shippingInfo.country) {
          return res.status(400).json({ error: 'Missing required shipping information' });
      }
      
      if (!paymentMethod) {
          return res.status(400).json({ error: 'Payment method is required' });
      }
      
      // Create order in database
      const orderId = await db.createOrder(userId, items, subtotal, shipping, tax, total, paymentMethod, shippingInfo);
      
      // Return success response
      res.status(201).json({ 
          success: true, 
          message: 'Order created successfully', 
          orderId: orderId 
      });
  } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// ... existing code ...

// Add this API endpoint after your other API routes
app.get('/api/auth/status', (req, res) => {
  res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.isAuthenticated() ? {
          id: req.user.IDTaiKhoan,
          name: req.user.TenNguoiDung,
          email: req.user.Email,
          role: req.user.VaiTro
      } : null
  });
});

// ... rest of existing code ...