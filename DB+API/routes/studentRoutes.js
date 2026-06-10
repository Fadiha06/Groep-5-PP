const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, requireRole('student'), StudentController.getDashboard);

module.exports = router;