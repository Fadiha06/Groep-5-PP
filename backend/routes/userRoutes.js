const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, requireRole(['admin', 'administrator']), userController.getUsers);

router.post('/', verifyToken, requireRole(['admin', 'administrator']), userController.createAccount);

router.delete('/:id', verifyToken, requireRole(['admin', 'administrator']), userController.deleteUser);

module.exports = router;
