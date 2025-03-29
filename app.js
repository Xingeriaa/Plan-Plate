const express = require('express');
const passport = require('passport');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
// Import your database configuration
const db = require('./config/db');

// Initialize environment variables
dotenv.config();

const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Use env variable with fallback
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Secure in production
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes for OAuth authentication
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
res.redirect('/profile'); // Redirect to profile page after successful login
});

app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
res.redirect('/profile');
});

// Add before your routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import authentication routes
const authRoutes = require('./routes/auth');

// Use authentication routes
app.use('/', authRoutes);

// Profile route to check if user is logged in
app.get('/profile', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  res.render('profile', { 
    user: req.user,
    name: req.user.TenNguoiDung,
    email: req.user.Email
  });
});

// Serve static files like CSS and JavaScript from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Route for serving index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));  // Serve the homepage
});

// Then change your login route to:
app.get('/login', (req, res) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('login');  // This will look for login.ejs in the views folder
});

app.get('/signup', (req, res) => {
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('signup');  // Fixed typo: changed 'singup' to 'signup'
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Add near the top of your file after requiring passport
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// Configure passport strategies
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Store user in database or just return profile
    return done(null, profile);
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/auth/github/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Store user in database or just return profile
    return done(null, profile);
  }
));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});


// Configure local strategy for authentication with MSSQL
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      // Get user from database
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        console.log('User not found');
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      // Check if password exists in the user record
      if (!user.MatKhau) {
        console.log('User has no password stored');
        return done(null, false, { message: 'Invalid account configuration' });
      }
      
      // Log password information for debugging (remove in production)
      console.log('Password provided:', !!password);
      console.log('Stored hash exists:', !!user.MatKhau);
      
      // Compare password with hashed password in database
      const isMatch = await bcrypt.compare(password, user.MatKhau);
      
      if (!isMatch) {
        console.log('Password does not match');
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      return done(null, user);
    } catch (error) {
      console.error('Authentication error:', error);
      return done(error);
    }
  }
));

// Update serialize/deserialize to work with MSSQL
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Add these routes for handling login and signup
app.post('/login', (req, res, next) => {
  // Check if user is already logged in
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
  // Check if user is already logged in
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    // Basic validation
    if (password !== confirmPassword) {
      return res.redirect('/signup?error=Passwords do not match');
    }
    
    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.redirect('/signup?error=Email already in use');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user in MSSQL
    const newUser = await db.createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });
    
    // Auto-login after signup
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
