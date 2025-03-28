const express = require('express');
const passport = require('passport');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');

// Initialize environment variables
dotenv.config();

const app = express();

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
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

// Profile route to check if user is logged in
app.get('/profile', (req, res) => {
if (!req.user) {
    return res.redirect('/'); // Redirect to home if not logged in
}
res.send(`<h1>Hello, ${req.user.displayName || req.user.username}!</h1>`); // Display user profile
});

// Serve static files like CSS and JavaScript from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Route for serving index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));  // Serve the homepage
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.ejs')); // or 'login.ejs'
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
      res.redirect('/');
    });
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
