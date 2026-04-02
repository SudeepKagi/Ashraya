// FILE: server/controllers/guardianController.js
const User = require('../models/User');
const DailySchedule = require('../models/DailySchedule');
const HealthLog = require('../models/HealthLog');
const EmotionLog = require('../models/EmotionLog');

const startOfDay = (d = new Date()) => {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
};

const endOfDay = (d = new Date()) => {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
};

const getTaskStats = (tasks = []) => {
    const done = tasks.filter((task) => task.status === 'done').length;
    const skipped = tasks.filter((task) => task.status === 'skipped').length;
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const refused = tasks.filter((task) => task.status === 'refused').length;
    const total = tasks.length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { done, skipped, pending, refused, total, completionRate };
};

const getLinkedElder = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked to this guardian account' });
        }

        const elder = await User.findById(guardian.elderId)
            .select('name age gender profile accessibility baseline')
            .lean();

        if (!elder) {
            return res.status(404).json({ message: 'Linked elder not found' });
        }

        const elderId = elder._id;
        const todayStart = startOfDay();
        const todayEnd = endOfDay();

        const todaySchedule = await DailySchedule.findOne({
            elderId,
            date: { $gte: todayStart, $lte: todayEnd }
        }).lean();
        const stats = getTaskStats(todaySchedule?.tasks || []);

        const latestEmotion = await EmotionLog.findOne({
            elderId,
            date: { $gte: todayStart, $lte: todayEnd }
        }).sort({ updatedAt: -1 }).lean();

        const anomalies = await HealthLog.find({
            elderId,
            timestamp: { $gte: todayStart, $lte: todayEnd },
            isAnomaly: true
        }).sort({ timestamp: -1 }).limit(10).lean();

        const [latestHRLog, latestSpO2Log, latestBPLog] = await Promise.all([
            HealthLog.findOne({ elderId, type: 'hr' }).sort({ timestamp: -1 }).lean(),
            HealthLog.findOne({ elderId, type: 'spo2' }).sort({ timestamp: -1 }).lean(),
            HealthLog.findOne({ elderId, type: 'bp' }).sort({ timestamp: -1 }).lean()
        ]);

        res.json({
            elder: {
                _id: elder._id,
                name: elder.name,
                age: elder.age,
                gender: elder.gender,
                profile: elder.profile,
                baseline: elder.baseline,
                accessibilityNeeds: elder.accessibility
            },
            today: {
                stats,
                moodScore: latestEmotion?.dailyMoodScore ?? null,
                moodLabel: latestEmotion?.sessions?.slice(-1)[0]?.moodLabel ?? null,
                anomalies,
                latestHR: latestHRLog?.value ?? null,
                latestSpO2: latestSpO2Log?.value ?? null,
                latestBP: latestBPLog?.value ?? null
            }
        });
    } catch (err) {
        console.error('getLinkedElder error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getAlerts = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const days = parseInt(req.query.days, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const elderId = guardian.elderId;

        const [healthAlerts, emotionAlerts] = await Promise.all([
            HealthLog.find({
                elderId,
                timestamp: { $gte: since },
                isAnomaly: true
            }).sort({ timestamp: -1 }).limit(limit).lean(),
            EmotionLog.find({
                elderId,
                date: { $gte: since },
                'sessions.concernFlag': true
            }).sort({ date: -1 }).limit(limit).lean()
        ]);

        const allAlerts = [
            ...healthAlerts.map((alert) => ({
                _id: alert._id,
                type: alert.type === 'fall'
                    ? 'fall_detected'
                    : alert.type === 'sos'
                        ? 'sos_triggered'
                        : alert.type === 'medicine_supply'
                            ? 'medicine_supply'
                        : 'health_anomaly',
                anomalyReason: alert.anomalyReason,
                value: { type: alert.type, reading: alert.value },
                timestamp: alert.timestamp,
                isAnomaly: true,
                isRead: Boolean(alert.isRead)
            })),
            ...emotionAlerts.map((alert) => ({
                _id: alert._id,
                type: 'emotion_alert',
                concern: alert.sessions?.find((session) => session.concernFlag)?.moodLabel,
                moodScore: alert.dailyMoodScore,
                timestamp: alert.date,
                isAnomaly: true,
                isRead: Boolean(alert.isRead)
            }))
        ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

        res.json({ alerts: allAlerts });
    } catch (err) {
        console.error('getAlerts error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const markAlertRead = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const { id } = req.params;

        const healthAlert = await HealthLog.findOneAndUpdate(
            { _id: id, elderId: guardian.elderId },
            { $set: { isRead: true } },
            { new: true }
        );

        if (healthAlert) {
            return res.json({ message: 'Alert marked as read', alert: healthAlert });
        }

        const emotionAlert = await EmotionLog.findOneAndUpdate(
            { _id: id, elderId: guardian.elderId },
            { $set: { isRead: true } },
            { new: true }
        );

        if (emotionAlert) {
            return res.json({ message: 'Alert marked as read', alert: emotionAlert });
        }

        return res.status(404).json({ message: 'Alert not found' });
    } catch (err) {
        console.error('markAlertRead error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getHistory = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
        const elderId = guardian.elderId;
        const history = [];

        for (let i = 0; i < days; i += 1) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);

            const [schedule, emotion] = await Promise.all([
                DailySchedule.findOne({ elderId, date: { $gte: dayStart, $lte: dayEnd } })
                    .select('tasks')
                    .lean(),
                EmotionLog.findOne({ elderId, date: { $gte: dayStart, $lte: dayEnd } })
                    .select('dailyMoodScore')
                    .sort({ updatedAt: -1 })
                    .lean()
            ]);

            const stats = getTaskStats(schedule?.tasks || []);

            if (stats.total > 0 || emotion) {
                history.push({
                    date: dayStart,
                    completionRate: stats.total > 0 ? stats.completionRate : null,
                    totalTasks: stats.total,
                    doneTasks: stats.done,
                    moodScore: emotion?.dailyMoodScore ?? null
                });
            }
        }

        res.json({ history });
    } catch (err) {
        console.error('getHistory error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getHealthTrend = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const { type } = req.params;
        const days = parseInt(req.query.days, 10) || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const logs = await HealthLog.find({
            elderId: guardian.elderId,
            type,
            timestamp: { $gte: since }
        }).sort({ timestamp: 1 }).lean();

        res.json({ type, days, logs });
    } catch (err) {
        console.error('getHealthTrend error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const updateElderAccessibility = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const elder = await User.findByIdAndUpdate(
            guardian.elderId,
            { $set: { accessibility: req.body } },
            { new: true, select: 'name accessibility' }
        ).lean();

        res.json({ message: 'Accessibility settings updated', elder });
    } catch (err) {
        console.error('updateElderAccessibility error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = {
    getLinkedElder,
    getAlerts,
    markAlertRead,
    getHistory,
    getHealthTrend,
    updateElderAccessibility
};
