// FILE: server/routes/auth.js
const express = require('express');
const router = express.Router();
const { registerElder, registerGuardian, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/elder/register', registerElder);
router.post('/guardian/register', registerGuardian);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;