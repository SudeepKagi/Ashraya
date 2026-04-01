// FILE: server/routes/health.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { logHealth, logFallAlert, streamWatchData, getHealthLogs } = require('../controllers/healthController');

router.post('/log', protect, logHealth);
router.post('/fall-alert', protect, logFallAlert);
router.post('/watch-stream', protect, streamWatchData);   // ← THIS WAS MISSING
router.get('/logs/:elderId', protect, getHealthLogs);

module.exports = router;