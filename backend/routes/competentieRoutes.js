const express = require('express');
const router = express.Router();
const competentieController = require('../controllers/competentieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Competenties
router.get('/', verifyToken, competentieController.getAllCompetenties);
router.post('/', verifyToken, requireRole(['admin', 'administrator']), competentieController.createCompetentie);
router.put('/:id', verifyToken, requireRole(['admin', 'administrator']), competentieController.updateCompetentie);
router.delete('/:id', verifyToken, requireRole(['admin', 'administrator']), competentieController.deleteCompetentie);

// Rubriek (niveaus) per competentie
router.get('/:id/rubriek', verifyToken, competentieController.getRubriek);
router.put('/:id/rubriek', verifyToken, requireRole(['admin', 'administrator']), competentieController.saveRubriek);

module.exports = router;