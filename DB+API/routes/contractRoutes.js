const express = require('express');
const router = express.Router();
const ContractController = require('../controllers/contractController');
const authMiddleware = require('../middleware/authMiddleware');

// Route om een magic link te genereren voor de mentor (bijv. opgevraagd door student of admin)
router.get('/:id/mentor-link', ContractController.generateMentorLink);

// Route om een handtekening te plaatsen (vereist inloggen of een magic link token)
router.post('/:id/tekenen', authMiddleware, ContractController.signContract);

module.exports = router;
