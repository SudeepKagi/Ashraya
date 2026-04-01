// FILE: server/routes/emotion.js
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { saveCheckin, getToday, getTrend } = require('../controllers/emotionController');

router.post('/checkin', protect, requireRole('elder'), saveCheckin);
router.get('/today', protect, requireRole('elder'), getToday);
router.get('/trend/:elderId', protect, getTrend);

module.exports = router;