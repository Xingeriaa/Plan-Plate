const express = require('express');
const passport = require('passport');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const db = require('./config/db');

dotenv.config();

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
        const categories = await db.getAllCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
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

app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('login');
});

app.get('/signup', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('signup');
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
app.get('/admin', isAdmin, async (req, res) => {
  try {
    // Fetch dashboard statistics
    const stats = await db.getDashboardStats();
    
    // Fetch recent orders
    const recentOrders = await db.getRecentOrders(5); // Get 5 most recent orders
    
    // Fetch low stock products
    const lowStockProducts = await db.getLowStockProducts(5); // Get 5 products with lowest stock
    
    // Fetch sales data for chart (default to month period)
    const salesData = await db.getSalesData('month');
    
    res.render('admin/dashboard', { 
      user: req.user,
      name: req.user.TenNguoiDung,
      email: req.user.Email,
      stats,
      recentOrders,
      lowStockProducts,
      salesData
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', { message: 'Failed to load dashboard data' });
  }
});

app.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.render('admin/users', { 
      user: req.user,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('error', { message: 'Failed to load users' });
  }
});

// Add these routes after your existing admin routes

// Add a new user (admin only)
app.post('/admin/users/add', isAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await db.addUser({
      name,
      email,
      password: hashedPassword,
      role
    });
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).render('error', { message: 'Failed to add user' });
  }
});

// Update user role
app.post('/admin/users/:id/role', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    await db.updateUserRole(userId, role);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Delete user
app.delete('/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    await db.deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Edit user page
app.get('/admin/users/edit/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    res.render('admin/edit-user', { user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).render('error', { message: 'Failed to fetch user details' });
  }
});

// Update user
app.post('/admin/users/edit/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, password } = req.body;
    
    // Update user basic info
    await db.updateUser(userId, { 
      TenNguoiDung: name, 
      Email: email, 
      VaiTro: role 
    });
    
    // If password is provided, update it
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.updateUserPassword(userId, hashedPassword);
    }
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).render('error', { message: 'Failed to update user' });
  }
});

// Search API endpoint
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 3) {
            return res.json([]);
        }
        
        const results = await db.searchProducts(query);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'An error occurred while searching products' });
    }
});
