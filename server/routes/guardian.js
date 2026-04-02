// FILE: server/routes/guardian.js
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
    getLinkedElder, getAlerts, markAlertRead, getHistory, getHealthTrend, updateElderAccessibility
} = require('../controllers/guardianController');

router.get('/elder', protect, requireRole('guardian'), getLinkedElder);
router.get('/alerts', protect, requireRole('guardian'), getAlerts);
router.put('/alerts/:id/read', protect, requireRole('guardian'), markAlertRead);
router.get('/history', protect, requireRole('guardian'), getHistory);
router.get('/health-trend/:type', protect, requireRole('guardian'), getHealthTrend);
router.put('/elder/accessibility', protect, requireRole('guardian'), updateElderAccessibility);

module.exports = router;
