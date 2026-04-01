// FILE: server/routes/guardian.js
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
router.get('/elder', protect, requireRole('guardian'), (req, res) => res.json({ success: true, message: 'Guardian route active' }));
module.exports = router;