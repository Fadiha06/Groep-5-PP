const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, requireRole('student'), StudentController.getDashboard);

router.get('/logboek', verifyToken, requireRole('student'), StudentController.getLogboek);
router.post('/logboek/dag', verifyToken, requireRole('student'), StudentController.saveLogboekDag);

module.exports = router;