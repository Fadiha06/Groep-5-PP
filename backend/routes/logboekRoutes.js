const express = require('express');
const router = express.Router();
const logboekController = require('../controllers/logboekController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/:logId/weken', logboekController.getLogboekWeken);
router.put('/:logId/feedback', logboekController.saveFeedback);
router.put('/:logId/goedkeuren', logboekController.approveLogboek);

module.exports = router;
