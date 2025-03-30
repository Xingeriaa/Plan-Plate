const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/login');
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

// Middleware to check if user is admin
async function isAdmin(req, res, next) {
  try {
    // First check if authenticated
    if (!req.user) {
      return res.redirect('/login');
    }
    
    // Get user from database to check role
    const user = await db.getUserById(req.user.id);
    
    if (!user || user.VaiTro !== 'Admin') {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        error: { status: 403 }
      });
    }
    
    // Add user data to request for use in admin templates
    req.adminUser = user;
    
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while checking permissions.',
      error: { status: 500 }
    });
  }
}

// Middleware to check if user is the owner of the resource or an admin
async function isOwnerOrAdmin(req, res, next) {
  try {
    // First check if authenticated
    if (!req.user) {
      return res.redirect('/login');
    }
    
    // Get user from database to check role
    const user = await db.getUserById(req.user.id);
    
    // If user is admin, allow access
    if (user && user.VaiTro === 'Admin') {
      req.adminUser = user;
      return next();
    }
    
    // Check if user is the owner of the resource
    const resourceId = parseInt(req.params.id);
    const resourceType = req.baseUrl.split('/').pop(); // e.g., 'orders', 'products'
    
    let isOwner = false;
    
    if (resourceType === 'orders') {
      const order = await db.getOrderById(resourceId);
      isOwner = order && order.IDKhachHang === req.user.id;
    } else if (resourceType === 'profile') {
      isOwner = resourceId === req.user.id;
    }
    
    if (!isOwner) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this resource.',
        error: { status: 403 }
      });
    }
    
    next();
  } catch (error) {
    console.error('Owner/Admin authentication error:', error);
    return res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while checking permissions.',
      error: { status: 500 }
    });
  }
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isOwnerOrAdmin
};