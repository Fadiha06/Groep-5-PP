const express = require('express');
const router = express.Router();
const competentieController = require('../controllers/competentieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Lezen mag elke ingelogde gebruiker (docent/mentor/student tonen competenties)
router.get('/', verifyToken, competentieController.getAllCompetenties);

// Aanpassen mag alleen de admin
router.post('/', verifyToken, requireRole(['admin', 'administrator']), competentieController.createCompetentie);
router.put('/:id', verifyToken, requireRole(['admin', 'administrator']), competentieController.updateCompetentie);
router.delete('/:id', verifyToken, requireRole(['admin', 'administrator']), competentieController.deleteCompetentie);

module.exports = router;