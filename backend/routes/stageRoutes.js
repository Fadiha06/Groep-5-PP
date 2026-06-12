const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stageController');
const auth = require('../middleware/authMiddleware');

// Submit a new stage proposal
router.post('/submit', auth, stageController.submitStage);

// Get all stage proposals (for commissie)
router.get('/all', auth, stageController.getAllStages);

// Get my stage proposal (for student)
router.get('/my-stage', auth, stageController.getMyStage);

// Update stage status (approve/reject)
router.put('/:id/status', auth, stageController.updateStatus);

module.exports = router;
