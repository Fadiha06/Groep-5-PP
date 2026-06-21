const express = require('express');
const router = express.Router();
const evaluatieController = require('../controllers/evaluatieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/competenties', evaluatieController.getCompetenties);
router.get('/concept', evaluatieController.getConcept);
router.post('/opslaan', requireRole(['docent', 'mentor', 'stagementor', 'administrator', 'admin']), evaluatieController.saveEvaluatie);

module.exports = router;
