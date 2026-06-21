const express = require('express');
const router = express.Router();
const {
    getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen,
    getLogboeken, goedkeurLogboek, geefLogboekFeedback,
    getEvaluatieStudenten, getEvaluatie, slaEvaluatieOp, getLogboekEvaluatie,
    getAggregatie
} = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const auth = [verifyToken, requireRole('docent')];

router.get('/studenten',                      ...auth, getStudenten);
router.post('/reminder',                      ...auth, stuurReminder);
router.get('/milestones',                     ...auth, getMilestones);
router.get('/dossiers',                       ...auth, getDossiers);
router.get('/student/:gebruikerId/meldingen', ...auth, getMeldingen);

// Logboeken
router.get('/logboeken',                      ...auth, getLogboeken);
router.post('/logboek/goedkeuren',            ...auth, goedkeurLogboek);
router.post('/logboek/feedback',              ...auth, geefLogboekFeedback);

// Evaluaties — versie van je teamgenoot
router.get('/evaluatie-studenten',            ...auth, getEvaluatieStudenten);
router.get('/evaluatie',                      ...auth, getEvaluatie);
router.post('/evaluatie/opslaan',             ...auth, slaEvaluatieOp);
router.get('/logboek/evaluatie',              ...auth, getLogboekEvaluatie);

// Aggregatie
router.get('/aggregatie',                     ...auth, getAggregatie);

module.exports = router;