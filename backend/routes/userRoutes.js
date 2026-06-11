const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Alle gebruikers ophalen
router.get('/', userController.getUsers);

// Account aanmaken door Admin
router.post('/', userController.createAccount);

// Gebruiker verwijderen
router.delete('/:id', userController.deleteUser);

module.exports = router;
