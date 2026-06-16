const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/evaluaties', verifyToken, requireRole('student'), StudentController.getEvaluaties);

module.exports = router;
