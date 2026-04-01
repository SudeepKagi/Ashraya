// FILE: server/controllers/healthController.js

const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { checkAnomaly } = require('../utils/anomalyDetection');
const { getIO } = require('../socket/socketHandler');
const notificationService = require('../services/notificationService');

/**
 * POST /api/health/log
 * Logs a health metric. Checks for anomaly. Emits socket event if needed.
 */
const logHealth = async (req, res) => {
    try {
        const { type, value } = req.body;
        const elderId = req.user.id;

        if (!type || value === undefined) {
            return res.status(400).json({ message: 'type and value are required' });
        }

        // Fetch elder's baseline for anomaly check
        const elder = await User.findById(elderId).select('baseline guardianId profile');
        const { isAnomaly, reason } = checkAnomaly(type, value, elder?.baseline);

        const log = await HealthLog.create({
            elderId,
            type,
            value,
            isAnomaly,
            anomalyReason: reason
        });

        // If anomaly, alert guardian via socket + push
        if (isAnomaly && elder?.guardianId) {
            const io = getIO();
            io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                elderId,
                type,
                value,
                baseline: elder.baseline,
                reason,
                timestamp: new Date()
            });

            // Send FCM push to guardian
            const guardian = await User.findById(elder.guardianId).select('fcmToken name');
            if (guardian?.fcmToken) {
                await notificationService.sendPush(
                    guardian.fcmToken,
                    '⚠️ Health Alert — Ashraya',
                    reason
                );
            }

            await HealthLog.findByIdAndUpdate(log._id, { alertSent: true });
        }

        res.status(201).json({ log, isAnomaly, reason });

    } catch (err) {
        console.error('logHealth error:', err.message);
        res.status(500).json({ message: 'Failed to log health data' });
    }
};

/**
 * POST /api/health/fall-alert
 * Called when fall is confirmed (no response from elder in 60s).
 */
const logFallAlert = async (req, res) => {
    try {
        const elderId = req.user.id;
        const { timestamp } = req.body;

        const elder = await User.findById(elderId).select('name guardianId profile');

        // Log fall event
        const log = await HealthLog.create({
            elderId,
            type: 'fall',
            value: true,
            isAnomaly: true,
            anomalyReason: 'Fall detected — no confirmation from elder',
            alertSent: false
        });

        const io = getIO();

        // Alert guardian via socket
        if (elder?.guardianId) {
            io.to(`guardian_${elder.guardianId}`).emit('fall_detected', {
                elderId,
                elderName: elder.name,
                timestamp: timestamp || new Date()
            });

            // FCM push to guardian
            const guardian = await User.findById(elder.guardianId).select('fcmToken');
            if (guardian?.fcmToken) {
                await notificationService.sendPush(
                    guardian.fcmToken,
                    '🚨 FALL DETECTED — Ashraya',
                    `${elder.name} may have fallen. Please check immediately.`
                );
            }

            // Also alert emergency contact if available
            const emergencyPhone = elder.profile?.emergencyContact?.phone;
            // (SMS integration can go here if Twilio is added later)

            await HealthLog.findByIdAndUpdate(log._id, { alertSent: true });
        }

        res.status(201).json({ message: 'Fall alert sent', log });

    } catch (err) {
        console.error('logFallAlert error:', err.message);
        res.status(500).json({ message: 'Failed to send fall alert' });
    }
};

/**
 * GET /api/health/logs/:elderId
 * Guardian fetches elder's health history
 */
const getHealthLogs = async (req, res) => {
    try {
        const { elderId } = req.params;
        const { type, limit = 50, days = 7 } = req.query;

        const since = new Date();
        since.setDate(since.getDate() - Number(days));

        const query = { elderId, timestamp: { $gte: since } };
        if (type) query.type = type;

        const logs = await HealthLog.find(query)
            .sort({ timestamp: -1 })
            .limit(Number(limit));

        res.json({ logs });

    } catch (err) {
        console.error('getHealthLogs error:', err.message);
        res.status(500).json({ message: 'Failed to fetch health logs' });
    }
};

module.exports = { logHealth, logFallAlert, getHealthLogs };