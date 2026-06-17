const express = require('express');
const router = express.Router();
const competentieController = require('../controllers/competentieController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, competentieController.getAllCompetenties);
router.post('/', verifyToken, competentieController.createCompetentie);
router.put('/:id', verifyToken, competentieController.updateCompetentie);
router.delete('/:id', verifyToken, competentieController.deleteCompetentie);

module.exports = router;