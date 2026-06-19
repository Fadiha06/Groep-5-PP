const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/opleidingen', verifyToken, requireRole(['admin', 'administrator']), adminController.getOpleidingen);
router.get('/competenties', verifyToken, requireRole(['admin', 'administrator']), adminController.getCompetenties);
router.post('/competenties', verifyToken, requireRole(['admin', 'administrator']), adminController.saveCompetenties);

router.get('/dashboard/stats', verifyToken, requireRole(['admin', 'administrator']), adminController.getDashboardStats);
router.get('/dashboard/actie-vereist', verifyToken, requireRole(['admin', 'administrator']), adminController.getActionRequired);
router.get('/dashboard/activiteit', verifyToken, requireRole(['admin', 'administrator']), adminController.getActivity);
router.get('/dashboard/contracts', verifyToken, requireRole(['admin', 'administrator']), adminController.getContractsList);

router.get('/contracten/:id/controle', verifyToken, requireRole(['admin', 'administrator']), adminController.getContractControle);
router.patch('/contracten/:id/controle', verifyToken, requireRole(['admin', 'administrator']), adminController.saveContractControle);
router.post('/contracten/:id/afwijzen', verifyToken, requireRole(['admin', 'administrator']), adminController.rejectContract);
router.post('/contracten/:id/goedkeuren', verifyToken, requireRole(['admin', 'administrator']), adminController.approveContract);

router.get('/contracts/:id', verifyToken, requireRole(['admin', 'administrator']), adminController.getContractDetails);
router.put('/contracts/:id/review', verifyToken, requireRole(['admin', 'administrator']), adminController.reviewContract);
router.get('/reports', verifyToken, requireRole(['admin', 'administrator']), adminController.getReports);
router.get('/rapporten', verifyToken, requireRole(['admin', 'administrator']), adminController.getAdminRapporten);
router.post('/rapporten/export', verifyToken, requireRole(['admin', 'administrator']), adminController.exportRapporten);

router.post('/mentors', verifyToken, requireRole(['admin', 'administrator']), adminController.createMentor);
router.post('/docent-toewijzen', verifyToken, requireRole(['admin', 'administrator', 'docent', 'stagecommissie']), adminController.assignDocent);
router.get('/stages-zonder-mentor', verifyToken, requireRole(['admin', 'administrator']), adminController.getStagesZonderMentor);
router.get('/stages-zonder-docent', verifyToken, requireRole(['admin', 'administrator', 'docent', 'stagecommissie']), adminController.getStagesZonderDocent);

module.exports = router;
