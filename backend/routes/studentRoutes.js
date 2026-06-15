const express = require('express');
const router = express.Router();
const { vulDagIn, getWeek, dienWeekIn, getLaatste, getStageInfo } = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// POST /api/student/logboek — een dag invullen of bijwerken
router.post('/logboek', verifyToken, requireRole('student'), vulDagIn);

// GET /api/student/logboek/week/:nr — een week ophalen met al zijn dagen
router.get('/logboek/week/:nr', verifyToken, requireRole('student'), getWeek);

// PUT /api/student/logboek/week/:nr/indienen — een week indienen
router.put('/logboek/week/:nr/indienen', verifyToken, requireRole('student'), dienWeekIn);

router.get('/logboek/laatste', verifyToken, requireRole('student'), getLaatste);

router.get('/stage-info', verifyToken, requireRole('student'), getStageInfo);
module.exports = router;