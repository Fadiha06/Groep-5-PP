const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Inloggen
router.post('/login', authController.login);

// Nieuw wachtwoord instellen via token
router.post('/set-password', authController.setPassword);



module.exports = router;
