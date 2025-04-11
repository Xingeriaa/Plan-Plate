const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const db = require('./db');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure Passport for sessions
passport.serializeUser((user, done) => {
  // Serialize the database user object, not the OAuth profile
  done(null, user.IDTaiKhoan || user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Get user from database by ID
    const user = await db.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy for email/password login
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        return done(null, false, { message: 'Email không tồn tại' });
      }
      
      // Skip password check for OAuth users
      if (!user.MatKhau) {
        return done(null, false, { 
          message: 'Tài khoản này được đăng ký qua Google hoặc GitHub. Vui lòng sử dụng phương thức đăng nhập tương ứng.' 
        });
      }
      
      const isMatch = await bcrypt.compare(password, user.MatKhau);
      
      if (!isMatch) {
        return done(null, false, { message: 'Mật khẩu không chính xác' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    // Just pass the profile to the callback
    // We'll handle user creation/retrieval in the route handler
    return done(null, profile);
  }
));

// GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback",
    scope: ['user:email'] // Request email scope
  },
  (accessToken, refreshToken, profile, done) => {
    // Just pass the profile to the callback
    // We'll handle user creation/retrieval in the route handler
    return done(null, profile);
  }
));

module.exports = passport;
