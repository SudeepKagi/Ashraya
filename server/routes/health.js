// FILE: server/routes/health.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { checkAnomaly } = require('../utils/anomalyDetection');

// @route  POST /api/health/fall-alert
// @access Elder only
router.post('/fall-alert', protect, async (req, res, next) => {
    try {
        const elder = await User.findById(req.user._id).select('name guardianId');

        const log = await HealthLog.create({
            elderId: req.user._id,
            type: 'fall',
            value: {
                type: req.body.type || 'fall',
                confirmedByElder: req.body.confirmedByElder || false
            },
            isAnomaly: true,
            anomalyReason: 'Fall detected — guardian alerted',
            alertSent: false
        });

        if (elder?.guardianId) {
            // Alert guardian via socket (they joined room with their userId)
            req.io.to(elder.guardianId.toString()).emit('sos_triggered', {
                elderId: elder._id,
                elderName: elder.name,
                timestamp: new Date(),
                type: req.body.type || 'manual_sos'
            });

            log.alertSent = true;
            await log.save();
        }

        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
});

// @route  POST /api/health/log
// @access Elder only — logs HR, SpO2, BP, steps + checks for anomaly
router.post('/log', protect, async (req, res, next) => {
    try {
        const { type, value, notes } = req.body;

        if (!type || value === undefined) {
            return res.status(400).json({ message: 'type and value are required' });
        }

        // Fetch elder baseline for anomaly comparison
        const elder = await User.findById(req.user._id).select('baseline guardianId name');
        const { isAnomaly, reason } = checkAnomaly(type, value, elder?.baseline);

        const log = await HealthLog.create({
            elderId: req.user._id,
            type,
            value,
            isAnomaly,
            anomalyReason: reason || null,
            alertSent: false,
            notes: notes || null
        });

        // If anomaly detected, alert guardian via socket
        if (isAnomaly && elder?.guardianId) {
            req.io.to(elder.guardianId.toString()).emit('health_anomaly', {
                elderId: elder._id,
                elderName: elder.name,
                type,
                value,
                reason,
                baseline: elder.baseline,
                timestamp: new Date()
            });

            log.alertSent = true;
            await log.save();
        }

        res.json({ success: true, log, isAnomaly, reason: reason || null });
    } catch (err) {
        next(err);
    }
});

// @route  GET /api/health/logs/:elderId
// @access Elder or Guardian
router.get('/logs/:elderId', protect, async (req, res, next) => {
    try {
        const { type, limit = 50, days = 7 } = req.query;

        const since = new Date();
        since.setDate(since.getDate() - Number(days));

        const query = {
            elderId: req.params.elderId,
            timestamp: { $gte: since }
        };
        if (type) query.type = type;

        const logs = await HealthLog.find(query)
            .sort({ timestamp: -1 })
            .limit(Number(limit));

        res.json({ success: true, logs });
    } catch (err) {
        next(err);
    }
});

module.exports = router;