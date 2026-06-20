const express = require('express');
const router = express.Router();
const evaluatieController = require('../controllers/evaluatieController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/competenties', evaluatieController.getCompetenties);
router.get('/concept', evaluatieController.getConcept);
router.get('/planning', evaluatieController.getPlanning);
router.post('/opslaan', evaluatieController.saveEvaluatie);

module.exports = router;