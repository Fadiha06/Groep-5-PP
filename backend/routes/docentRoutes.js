const express = require('express');
const router = express.Router();
const { getStudenten } = require('../controllers/docentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// GET /api/docent/studenten?week=4 — lijst voor "Logboek Controle"
router.get('/studenten', verifyToken, requireRole('docent'), getStudenten);

module.exports = router;