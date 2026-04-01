// FILE: server/routes/report.js
const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.json({ success: true, message: 'Report route active' }));
module.exports = router;