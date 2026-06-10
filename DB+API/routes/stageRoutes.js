const express = require('express');
const router = express.Router();
const StageController = require('../controllers/stageController');
const authMiddleware = require('../middleware/authMiddleware');

// Stagevoorstel indienen (vereist inloggen als student)
router.post('/voorstel', authMiddleware, StageController.submitVoorstel);

module.exports = router;
