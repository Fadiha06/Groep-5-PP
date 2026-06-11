const express = require('express');
const router = express.Router();
const { login, register, me } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register
router.post('/register', register);

// GET /api/auth/me (vereist login)
router.get('/me', verifyToken, me);

module.exports = router;