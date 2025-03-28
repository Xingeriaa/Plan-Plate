// authController.js

const loginUser = (req, res) => {
    // Add your login logic here
    res.send('User logged in');
};

const registerUser = (req, res) => {
    // Add your registration logic here
    res.send('User registered');
};

module.exports = { loginUser, registerUser };
