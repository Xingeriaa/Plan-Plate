const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('login', { error: req.query.error });
});

// Handle login
router.post('/login', (req, res, next) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.render('login', { error: info.message || 'Invalid credentials' });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/profile');
    });
  })(req, res, next);
});

// Signup page
router.get('/signup', (req, res) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('signup', { error: req.query.error });
});

// Handle signup
router.post('/signup', async (req, res) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    // Validate input
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.render('signup', { error: 'All fields are required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('signup', { error: 'Invalid email format' });
    }
    
    // Validate password
    if (password.length < 6) {
      return res.render('signup', { error: 'Password must be at least 6 characters' });
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.render('signup', { error: 'Passwords do not match' });
    }
    
    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.render('signup', { error: 'Email already in use' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');
    
    // Create user with hashed password
    const newUser = await db.createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });
    
    // Log in the new user
    req.login(newUser, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.redirect('/login');
      }
      return res.redirect('/profile');
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'Registration failed. Please try again.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/');
  });
});

// OAuth routes
router.get('/auth/google', (req, res, next) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Check if user exists in database
      const email = req.user.emails && req.user.emails[0] ? req.user.emails[0].value : null;
      if (!email) {
        return res.redirect('/login?error=Không thể lấy email từ tài khoản Google');
      }
      
      let user = await db.getUserByEmail(email);
      
      // If user doesn't exist, create a new one
      if (!user) {
        const displayName = req.user.displayName || 'Google User';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        user = await db.createUser({
          firstName,
          lastName,
          email,
          password: null, // No password for OAuth users
          provider: 'google',
          providerId: req.user.id
        });
      }
      
      // Set user in session
      req.login(user, (err) => {
        if (err) {
          console.error('Login error after Google auth:', err);
          return res.redirect('/login?error=Đăng nhập thất bại');
        }
        return res.redirect('/profile');
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.redirect('/login?error=Đăng nhập thất bại');
    }
  }
);

router.get('/auth/github', (req, res, next) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  passport.authenticate('github')(req, res, next);
});

router.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Get email from GitHub profile
      const email = req.user.emails && req.user.emails[0] ? req.user.emails[0].value : 
                   (req.user._json && req.user._json.email ? req.user._json.email : null);
      
      if (!email) {
        return res.redirect('/login?error=Không thể lấy email từ tài khoản GitHub');
      }
      
      let user = await db.getUserByEmail(email);
      
      // If user doesn't exist, create a new one
      if (!user) {
        const displayName = req.user.displayName || req.user.username || 'GitHub User';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        user = await db.createUser({
          firstName,
          lastName,
          email,
          password: null, // No password for OAuth users
          provider: 'github',
          providerId: req.user.id
        });
      }
      
      // Set user in session
      req.login(user, (err) => {
        if (err) {
          console.error('Login error after GitHub auth:', err);
          return res.redirect('/login?error=Đăng nhập thất bại');
        }
        return res.redirect('/profile');
      });
    } catch (error) {
      console.error('GitHub auth error:', error);
      res.redirect('/login?error=Đăng nhập thất bại');
    }
  }
);

// Authentication status check endpoint
router.get('/auth/check', (req, res) => {
  res.json({ 
    authenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? {
      id: req.user.IDTaiKhoan,
      name: req.user.TenNguoiDung,
      email: req.user.Email
    } : null
  });
});
module.exports = router;