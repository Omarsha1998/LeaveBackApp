const jwt = require('jsonwebtoken');
const UserModel = require('../models/UserModel');


const JWT_SECRET = 'secret';
const tokenBlacklist = new Set();

const UserController = {
  
  registerUser: async (req, res) => {
    const { username, password } = req.body;
    try {
      const message = await UserModel.registerUser(username, password);
      if (message === 'User registered successfully!') {
        res.status(201).send(message);
      } else {
        res.status(400).send(message);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Error registering user.');
    }
  },

  loginUser: async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await UserModel.loginUser(username, password);
      if (typeof user === 'object') {
        const token = jwt.sign(user, JWT_SECRET);
        res.cookie('token', token, { httpsOnly: true, secure: true });
        res.status(200).json({ message: 'Login successful!', token });
      } else {
        res.status(401).send(user);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Error during login.');
    }
  },

  logoutUser: (req, res) => {
    const token = req.header('authorization')?.split(' ')[1];
    if (token) {
      tokenBlacklist.add(token);
      res.status(200).send('Logout successful.');
    } else {
      res.status(400).send('Invalid request.');
    }
  },



  
};

module.exports = UserController;
