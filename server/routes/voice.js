// FILE: server/routes/voice.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { transcribeAudio, respondToElder } = require('../controllers/voiceController');

router.post('/transcribe', protect, transcribeAudio);
router.post('/respond', protect, respondToElder);

module.exports = router;
