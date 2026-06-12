const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stageController');
const auth = require('../middleware/authMiddleware');
const { verifyToken } = auth; // of pas destructuring direct toe bovenaan

// Submit a new stage proposal
router.post('/submit', verifyToken, stageController.submitStage);

// Get all stage proposals (for commissie)
router.get('/all', verifyToken, stageController.getAllStages);

// Get my stage proposal (for student)
router.get('/my-stage', verifyToken, stageController.getMyStage);

// Update stage status (approve/reject)
router.put('/:id/status', verifyToken, stageController.updateStatus);

module.exports = router;
