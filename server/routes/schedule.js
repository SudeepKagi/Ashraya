// FILE: server/routes/schedule.js
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getToday, generateSchedule, updateTask, getHistory } = require('../controllers/scheduleController');

router.get('/today', protect, requireRole('elder'), getToday);
router.post('/generate', protect, requireRole('elder'), generateSchedule);
router.put('/task/:taskId', protect, requireRole('elder'), updateTask);
router.get('/history/:elderId', protect, getHistory);

module.exports = router;