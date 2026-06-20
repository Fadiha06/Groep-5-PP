const express = require('express');
const router = express.Router();
const commissieController = require('../controllers/commissieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const auth = [verifyToken, requireRole(['stagecommissie', 'admin', 'administrator'])];

router.get('/stages', auth, commissieController.getStages);
router.get('/stages/:id', auth, commissieController.getStageDetails);
router.put('/stages/:id/beoordeel', auth, commissieController.beoordeelStage);

module.exports = router;
