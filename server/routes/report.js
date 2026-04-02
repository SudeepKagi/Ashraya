// FILE: server/routes/report.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getTodayReport,
    getHistory,
    generateReport,
    getReportPdf
} = require('../controllers/reportController');

router.get('/today', protect, getTodayReport);
router.get('/today/:elderId', protect, getTodayReport);
router.get('/history', protect, getHistory);
router.get('/history/:elderId', protect, getHistory);
router.post('/generate', protect, generateReport);
router.get('/pdf/:reportId', protect, getReportPdf);

module.exports = router;
