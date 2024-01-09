const express = require('express');
const router = express.Router();


const authMiddleware = require('../middleware/authMiddleware');
const UserController = require('../controllers/UserController');

router.post('/register', UserController.registerUser);
router.post('/login', UserController.loginUser);
router.post('/logout', authMiddleware.whiteListed, UserController.logoutUser);

module.exports = router;
