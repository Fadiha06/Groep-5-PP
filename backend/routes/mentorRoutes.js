const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { requireRole, verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(requireRole(['mentor', 'stagementor', 'docent', 'administrator']));

router.get('/studenten', mentorController.getStudenten);
router.get('/logboeken/pending', mentorController.getPendingLogboeken);
router.get('/logboeken', mentorController.getAllLogboeken);
router.get('/evaluaties/open', mentorController.getOpenEvaluaties);
router.get('/contracten', mentorController.getContracten);
router.get('/evaluatie', mentorController.getEvaluatie);
router.post('/logboek/feedback', mentorController.slaLogboekFeedbackOp);
router.post('/logboek/goedkeuren', mentorController.keurLogboekGoed);
router.post('/logboek/evaluatie', mentorController.slaEvaluatieOp);

module.exports = router;
