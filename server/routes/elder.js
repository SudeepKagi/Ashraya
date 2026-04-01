// FILE: server/routes/elder.js
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getProfile, updateProfile, getDashboard } = require('../controllers/elderController');

router.get('/profile', protect, requireRole('elder'), getProfile);
router.put('/profile', protect, requireRole('elder'), updateProfile);
router.get('/dashboard', protect, requireRole('elder'), getDashboard);

module.exports = router;