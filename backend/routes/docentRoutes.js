const express = require('express');
const router = express.Router();
const { getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen } = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// GET /api/docent/studenten?week=4 — lijst voor "Logboek Controle"
router.get('/studenten', verifyToken, requireRole('docent'), getStudenten);
router.post('/reminder', verifyToken, requireRole('docent'), stuurReminder);
router.get('/milestones', verifyToken, requireRole('docent'), getMilestones);
router.get('/dossiers', verifyToken, requireRole('docent'), getDossiers);
router.get('/student/:gebruikerId/meldingen', verifyToken, requireRole('docent'), getMeldingen);

module.exports = router;