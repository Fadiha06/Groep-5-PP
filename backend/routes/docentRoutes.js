const express = require('express');
const router = express.Router();
const { getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen, getLogboeken, keurLogboekGoed, geefLogboekFeedback, getTodos, getPunten } = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/studenten', verifyToken, requireRole('docent'), getStudenten);
router.post('/reminder', verifyToken, requireRole('docent'), stuurReminder);
router.get('/milestones', verifyToken, requireRole('docent'), getMilestones);
router.get('/dossiers', verifyToken, requireRole('docent'), getDossiers);
router.get('/student/:gebruikerId/meldingen', verifyToken, requireRole('docent'), getMeldingen);

router.get('/logboeken', verifyToken, requireRole('docent'), getLogboeken);
router.post('/logboek/goedkeuren', verifyToken, requireRole('docent'), keurLogboekGoed);
router.post('/logboek/feedback', verifyToken, requireRole('docent'), geefLogboekFeedback);

router.get('/todos', verifyToken, requireRole('docent'), getTodos);
router.get('/punten', verifyToken, requireRole('docent'), getPunten);

module.exports = router;