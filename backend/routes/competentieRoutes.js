const express = require('express');
const router = express.Router();
const competentieController = require('../controllers/competentieController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, competentieController.getAllCompetenties);
router.post('/', authMiddleware, competentieController.createCompetentie);
router.put('/:id', authMiddleware, competentieController.updateCompetentie);
router.delete('/:id', authMiddleware, competentieController.deleteCompetentie);

module.exports = router;
