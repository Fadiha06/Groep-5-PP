const express = require('express');
const router = express.Router();
const logboekController = require('../controllers/logboekController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/:logId/weken', logboekController.getLogboekWeken);
router.put('/:logId/feedback', requireRole(['stagementor', 'mentor', 'docent', 'administrator', 'admin']), logboekController.saveFeedback);
router.put('/:logId/goedkeuren', requireRole(['stagementor', 'mentor', 'docent', 'administrator', 'admin']), logboekController.approveLogboek);

module.exports = router;
