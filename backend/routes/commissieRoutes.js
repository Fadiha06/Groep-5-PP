const express = require('express');
const router = express.Router();
const commissieController = require('../controllers/commissieController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Leestoegang: stagecommissie (eigenaar) + admin (read-only inzage, frontend verbergt de acties)
router.get('/dashboard/actie-vereist', verifyToken, requireRole(['stagecommissie', 'commissie', 'admin', 'administrator']), commissieController.getActionRequired);
router.get('/contracten/:id/controle', verifyToken, requireRole(['stagecommissie', 'commissie', 'admin', 'administrator']), commissieController.getContractControle);

// Schrijftoegang: enkel de stagecommissie mag controleren/tekenen/goed- of afkeuren
router.patch('/contracten/:id/controle', verifyToken, requireRole(['stagecommissie', 'commissie']), commissieController.saveContractControle);
router.post('/contracten/:id/afwijzen', verifyToken, requireRole(['stagecommissie', 'commissie']), commissieController.rejectContract);
router.post('/contracten/:id/goedkeuren', verifyToken, requireRole(['stagecommissie', 'commissie']), commissieController.approveContract);

module.exports = router;
