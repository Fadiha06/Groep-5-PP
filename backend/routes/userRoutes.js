const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');


router.get('/', userController.getUsers);


router.post('/', userController.createAccount);


router.delete('/:id', userController.deleteUser);

module.exports = router;
