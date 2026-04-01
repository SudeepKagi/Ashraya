// FILE: server/controllers/healthController.js
const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { checkAnomaly } = require('../utils/anomalyDetection');
const { getIO } = require('../socket/socketHandler');
const notificationService = require('../services/notificationService');

/**
 * POST /api/health/log
 * Logs a health metric. Checks for anomaly. Emits socket event if anomaly.
 */
const logHealth = async (req, res) => {
    try {
        const { type, value } = req.body;
        const elderId = req.user._id;  // use _id consistently

        if (!type || value === undefined) {
            return res.status(400).json({ message: 'type and value are required' });
        }

        const elder = await User.findById(elderId).select('baseline guardianId profile name');
        const { isAnomaly, reason } = checkAnomaly(type, value, elder?.baseline);

        const log = await HealthLog.create({
            elderId,
            type,
            value,
            isAnomaly,
            anomalyReason: reason || null
        });

        if (isAnomaly && elder?.guardianId) {
            const io = getIO();
            // Emit to `guardian_${guardianId}` room (guardian joins this on login)
            io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                elderId,
                elderName: elder.name,
                type,
                value,
                baseline: elder.baseline,
                reason,
                timestamp: new Date()
            });

            const guardian = await User.findById(elder.guardianId).select('fcmToken');
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
 * Called when fall is confirmed (no elder response in 60s).
 */
const logFallAlert = async (req, res) => {
    try {
        const elderId = req.user._id;
        const { timestamp } = req.body;

        const elder = await User.findById(elderId).select('name guardianId profile');

        const log = await HealthLog.create({
            elderId,
            type: 'fall',
            value: 1,
            isAnomaly: true,
            anomalyReason: 'Fall detected — no confirmation from elder',
            alertSent: false
        });

        if (elder?.guardianId) {
            const io = getIO();
            io.to(`guardian_${elder.guardianId}`).emit('fall_detected', {
                elderId,
                elderName: elder.name,
                timestamp: timestamp || new Date()
            });

            const guardian = await User.findById(elder.guardianId).select('fcmToken');
            if (guardian?.fcmToken) {
                await notificationService.sendPush(
                    guardian.fcmToken,
                    '🚨 FALL DETECTED — Ashraya',
                    `${elder.name} may have fallen. Please check immediately.`
                );
            }

            await HealthLog.findByIdAndUpdate(log._id, { alertSent: true });
        }

        res.status(201).json({ message: 'Fall alert sent', log });

    } catch (err) {
        console.error('logFallAlert error:', err.message);
        res.status(500).json({ message: 'Failed to send fall alert' });
    }
};

/**
 * POST /api/health/watch-stream
 * Called every 5s by FallDetector — streams watch vitals.
 * Stores HR and SpO2 as individual logs; emits live to guardian.
 */
const streamWatchData = async (req, res) => {
    try {
        const elderId = req.user._id;
        const { hr, spo2, accel, steps } = req.body;

        const elder = await User.findById(elderId).select('guardianId baseline name');
        const io = getIO();

        const logsToCreate = [];

        if (hr !== undefined && hr !== null) {
            const { isAnomaly, reason } = checkAnomaly('hr', hr, elder?.baseline);
            logsToCreate.push({ elderId, type: 'hr', value: hr, isAnomaly, anomalyReason: reason });

            if (isAnomaly && elder?.guardianId) {
                io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                    elderId, elderName: elder.name, type: 'hr', value: hr,
                    baseline: elder.baseline, reason, timestamp: new Date()
                });
            }
        }

        if (spo2 !== undefined && spo2 !== null) {
            const { isAnomaly, reason } = checkAnomaly('spo2', spo2, elder?.baseline);
            logsToCreate.push({ elderId, type: 'spo2', value: spo2, isAnomaly, anomalyReason: reason });

            if (isAnomaly && elder?.guardianId) {
                io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                    elderId, elderName: elder.name, type: 'spo2', value: spo2,
                    baseline: elder.baseline, reason, timestamp: new Date()
                });
            }
        }

        if (accel) {
            logsToCreate.push({ elderId, type: 'accelerometer', value: accel, isAnomaly: false });
        }

        if (steps !== undefined && steps !== null) {
            logsToCreate.push({ elderId, type: 'steps', value: steps, isAnomaly: false });
        }

        if (logsToCreate.length > 0) {
            await HealthLog.insertMany(logsToCreate);
        }

        // Emit live vitals to guardian dashboard
        if (elder?.guardianId && (hr || spo2)) {
            io.to(`guardian_${elder.guardianId}`).emit('watch_live', {
                elderId,
                hr: hr ?? null,
                spo2: spo2 ?? null,
                timestamp: new Date()
            });
        }

        res.status(200).json({ received: logsToCreate.length });

    } catch (err) {
        console.error('streamWatchData error:', err.message);
        res.status(500).json({ message: 'Failed to stream watch data' });
    }
};

/**
 * GET /api/health/logs/:elderId
 * Guardian fetches elder's health history.
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

module.exports = { logHealth, logFallAlert, streamWatchData, getHealthLogs };