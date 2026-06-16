const express = require('express');
const router = express.Router();
const ContractController = require('../controllers/contractController');
const verifyToken = require('../middleware/authMiddleware');

// /mijn moet vóór /:id staan, anders vat Express "mijn" op als een id
router.get('/mijn', verifyToken, ContractController.getMijnContract);
router.get('/:id', verifyToken, ContractController.getContract);
router.post('/:id/tekenen', verifyToken, ContractController.tekenStudent);
router.get('/:id/mentor-link', verifyToken, ContractController.mentorLink);

// Mentor tekent via token in de link (geen login)
router.post('/mentor-tekenen', ContractController.tekenMentor);

module.exports = router;