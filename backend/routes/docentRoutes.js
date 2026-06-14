const express = require('express');
const router = express.Router();
const { getStudenten, stuurReminder, getMilestones } = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// GET /api/docent/studenten?week=4 — lijst voor "Logboek Controle"
router.get('/studenten', verifyToken, requireRole('docent'), getStudenten);
router.post('/reminder', verifyToken, requireRole('docent'), stuurReminder);
router.get('/milestones', verifyToken, requireRole('docent'), getMilestones);

module.exports = router;