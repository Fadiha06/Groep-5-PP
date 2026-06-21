const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Inloggen
router.post('/login', authController.login);
router.post('/set-password', authController.setPassword);
router.post('/forgot-password', authController.forgotPassword);

const { verifyToken } = require('../middleware/authMiddleware');
router.get('/me', verifyToken, authController.getMe);


module.exports = router;
