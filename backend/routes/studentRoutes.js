const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// ── main ──
router.get('/dashboard', verifyToken, requireRole('student'), StudentController.getDashboard);
router.get('/logboek', verifyToken, requireRole('student'), StudentController.getLogboek);
router.post('/logboek/dag', verifyToken, requireRole('student'), StudentController.saveLogboekDag);
router.get('/evaluaties', verifyToken, requireRole('student'), StudentController.getEvaluaties);

// ── logboek-feature ──
router.post('/logboek', verifyToken, requireRole('student'), StudentController.vulDagIn);
router.get('/logboek/week/:nr', verifyToken, requireRole('student'), StudentController.getWeek);
router.put('/logboek/week/:nr/indienen', verifyToken, requireRole('student'), StudentController.dienWeekIn);
router.get('/logboek/laatste', verifyToken, requireRole('student'), StudentController.getLaatste);
router.get('/stage-info', verifyToken, requireRole('student'), StudentController.getStageInfo);
router.get('/competenties', verifyToken, requireRole('student'), StudentController.getCompetenties);
router.get('/logboek/dag', verifyToken, requireRole('student'), StudentController.getDagOpDatum);
router.get('/logboek/dag/:dagId/competenties', verifyToken, requireRole('student'), StudentController.getDagCompetenties);
router.get('/profiel', verifyToken, requireRole('student'), StudentController.getProfiel);

module.exports = router;