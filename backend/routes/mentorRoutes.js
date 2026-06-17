const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { requireRole, verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(requireRole(['mentor', 'stagementor', 'administrator']));

router.get('/studenten', mentorController.getStudenten);
router.get('/logboeken/pending', mentorController.getPendingLogboeken);
router.get('/logboeken', mentorController.getAllLogboeken);
router.get('/evaluaties/open', mentorController.getOpenEvaluaties);

module.exports = router;
