const express = require('express');
const router = express.Router();
const {
    getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen,
    getLogboeken, goedkeurLogboek, geefLogboekFeedback,
    getEvaluatieStudenten, getEvaluatie, slaEvaluatieOp,
    getLogboekEvaluatie
} = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const auth = [verifyToken, requireRole('docent')];

router.get('/studenten',                    ...auth, getStudenten);
router.post('/reminder',                    ...auth, stuurReminder);
router.get('/milestones',                   ...auth, getMilestones);
router.get('/dossiers',                     ...auth, getDossiers);
router.get('/student/:gebruikerId/meldingen', ...auth, getMeldingen);

// Logboeken
router.get('/logboeken',                    ...auth, getLogboeken);
router.post('/logboek/goedkeuren',          ...auth, goedkeurLogboek);
router.post('/logboek/feedback',            ...auth, geefLogboekFeedback);

// Evaluaties
router.get('/evaluatie-studenten',          ...auth, getEvaluatieStudenten);
router.get('/evaluatie',                    ...auth, getEvaluatie);
router.post('/evaluatie/opslaan',           ...auth, slaEvaluatieOp);

// Logboek per-competentie scores (alleen lezen — mentor geeft de scores)
router.get('/logboek/evaluatie',            ...auth, getLogboekEvaluatie);

module.exports = router;
