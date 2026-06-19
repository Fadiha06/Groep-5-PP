const express = require('express');
const router = express.Router();
const competentieController = require('../controllers/competentieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, competentieController.getAllCompetenties);
router.post('/', verifyToken, requireRole(['admin', 'administrator']), competentieController.createCompetentie);
router.put('/:id', verifyToken, requireRole(['admin', 'administrator']), competentieController.updateCompetentie);

module.exports = router;
