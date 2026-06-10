const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');

router.get('/users', AdminController.getAllUsers);
router.post('/users', AdminController.createUser);

module.exports = router;
