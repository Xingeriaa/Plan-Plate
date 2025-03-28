const express = require('express');
const router = express.Router();
const { loginUser, registerUser } = require('../controllers/authController');

// POST route for login
router.post('/login', loginUser);

// POST route for registration
router.post('/register', registerUser);

module.exports = router; // Ensure you're exporting the router instance, not an object
