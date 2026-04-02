// FILE: server/controllers/healthController.js
const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { checkAnomaly } = require('../utils/anomalyDetection');
const { getIO } = require('../socket/socketHandler');
const notificationService = require('../services/notificationService');

const logHealth = async (req, res) => {
    try {
        const { type, value } = req.body;
        const elderId = req.user._id;

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
                    'Health Alert - Ashraya',
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

const logFallAlert = async (req, res) => {
    try {
        const elderId = req.user._id;
        const { timestamp, type, confirmedByElder } = req.body;
        const isManualSos = type === 'manual_sos';

        const elder = await User.findById(elderId).select('name guardianId');

        const log = await HealthLog.create({
            elderId,
            type: isManualSos ? 'sos' : 'fall',
            value: 1,
            isAnomaly: true,
            anomalyReason: isManualSos
                ? 'Manual SOS triggered by elder'
                : confirmedByElder
                    ? 'Fall alert confirmed by elder'
                    : 'Fall detected - no confirmation from elder',
            alertSent: false
        });

        if (elder?.guardianId) {
            const io = getIO();
            const payload = {
                elderId,
                elderName: elder.name,
                timestamp: timestamp || new Date()
            };

            io.to(`guardian_${elder.guardianId}`).emit(
                isManualSos ? 'sos_triggered' : 'fall_detected',
                payload
            );

            const guardian = await User.findById(elder.guardianId).select('fcmToken');
            if (guardian?.fcmToken) {
                await notificationService.sendPush(
                    guardian.fcmToken,
                    isManualSos ? 'SOS Alert - Ashraya' : 'FALL DETECTED - Ashraya',
                    isManualSos
                        ? `${elder.name} triggered an SOS alert. Please respond immediately.`
                        : `${elder.name} may have fallen. Please check immediately.`
                );
            }

            await HealthLog.findByIdAndUpdate(log._id, { alertSent: true });
        }

        res.status(201).json({
            message: isManualSos ? 'SOS alert sent' : 'Fall alert sent',
            log
        });
    } catch (err) {
        console.error('logFallAlert error:', err.message);
        res.status(500).json({ message: 'Failed to send fall alert' });
    }
};

const sendGuardianAlert = async (req, res) => {
    try {
        const elderId = req.user._id;
        const { category = 'general', message } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'message is required' });
        }

        const elder = await User.findById(elderId).select('name guardianId');

        const type = category === 'medicine_supply' ? 'medicine_supply' : 'sos';
        const alertReason = category === 'medicine_supply'
            ? `Medicine alert: ${message}`
            : message;

        const log = await HealthLog.create({
            elderId,
            type,
            value: { category, message },
            isAnomaly: true,
            anomalyReason: alertReason,
            alertSent: false,
            notes: message
        });

        if (elder?.guardianId) {
            const io = getIO();
            io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                elderId,
                elderName: elder.name,
                type,
                value: { category, message },
                reason: alertReason,
                timestamp: new Date()
            });

            const guardian = await User.findById(elder.guardianId).select('fcmToken');
            if (guardian?.fcmToken) {
                await notificationService.sendPush(
                    guardian.fcmToken,
                    category === 'medicine_supply' ? 'Medicine Alert - Ashraya' : 'Care Alert - Ashraya',
                    `${elder.name}: ${message}`
                );
            }

            await HealthLog.findByIdAndUpdate(log._id, { alertSent: true });
        }

        res.status(201).json({ message: 'Guardian alert sent', log });
    } catch (err) {
        console.error('sendGuardianAlert error:', err.message);
        res.status(500).json({ message: 'Failed to send guardian alert' });
    }
};

const streamWatchData = async (req, res) => {
    try {
        const elderId = req.user._id;
        const { hr, spo2, bp, accel, steps, battery, source } = req.body;

        const elder = await User.findById(elderId).select('guardianId baseline name');
        const io = getIO();
        const logsToCreate = [];
        const watchPayload = {
            elderId,
            hr: hr ?? null,
            spo2: spo2 ?? null,
            bp: bp ?? null,
            battery: battery ?? null,
            steps: steps ?? null,
            source: source || 'watch',
            timestamp: new Date()
        };

        if (hr !== undefined && hr !== null) {
            const { isAnomaly, reason } = checkAnomaly('hr', hr, elder?.baseline);
            logsToCreate.push({
                elderId,
                type: 'hr',
                value: hr,
                isAnomaly,
                anomalyReason: reason,
                alertSent: Boolean(isAnomaly && elder?.guardianId)
            });

            if (isAnomaly && elder?.guardianId) {
                io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                    elderId,
                    elderName: elder.name,
                    type: 'hr',
                    value: hr,
                    baseline: elder.baseline,
                    reason,
                    timestamp: new Date()
                });
            }
        }

        if (spo2 !== undefined && spo2 !== null) {
            const { isAnomaly, reason } = checkAnomaly('spo2', spo2, elder?.baseline);
            logsToCreate.push({
                elderId,
                type: 'spo2',
                value: spo2,
                isAnomaly,
                anomalyReason: reason,
                alertSent: Boolean(isAnomaly && elder?.guardianId)
            });

            if (isAnomaly && elder?.guardianId) {
                io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                    elderId,
                    elderName: elder.name,
                    type: 'spo2',
                    value: spo2,
                    baseline: elder.baseline,
                    reason,
                    timestamp: new Date()
                });
            }
        }

        if (bp?.systolic && bp?.diastolic) {
            const { isAnomaly, reason } = checkAnomaly('bp', bp, elder?.baseline);
            logsToCreate.push({
                elderId,
                type: 'bp',
                value: bp,
                isAnomaly,
                anomalyReason: reason,
                alertSent: Boolean(isAnomaly && elder?.guardianId)
            });

            if (isAnomaly && elder?.guardianId) {
                io.to(`guardian_${elder.guardianId}`).emit('health_anomaly', {
                    elderId,
                    elderName: elder.name,
                    type: 'bp',
                    value: bp,
                    baseline: elder.baseline,
                    reason,
                    timestamp: new Date()
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

        io.to(String(elderId)).emit('watch_live', watchPayload);

        if (elder?.guardianId && (hr !== undefined || spo2 !== undefined || bp || battery !== undefined || steps !== undefined)) {
            io.to(`guardian_${elder.guardianId}`).emit('watch_live', watchPayload);
        }

        res.status(200).json({ received: logsToCreate.length });
    } catch (err) {
        console.error('streamWatchData error:', err.message);
        res.status(500).json({ message: 'Failed to stream watch data' });
    }
};

const getHealthLogs = async (req, res) => {
    try {
        const { elderId } = req.params;
        const { type, limit = 50, days = 7 } = req.query;

        const since = new Date();
        since.setDate(since.getDate() - Number(days));

        const query = { elderId, timestamp: { $gte: since } };
        if (type) {
            query.type = type;
        }

        const logs = await HealthLog.find(query)
            .sort({ timestamp: -1 })
            .limit(Number(limit));

        res.json({ logs });
    } catch (err) {
        console.error('getHealthLogs error:', err.message);
        res.status(500).json({ message: 'Failed to fetch health logs' });
    }
};

module.exports = { logHealth, logFallAlert, sendGuardianAlert, streamWatchData, getHealthLogs };
