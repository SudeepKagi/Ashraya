// FILE: server/controllers/guardianController.js
const User = require('../models/User');
const Task = require('../models/Task');
const HealthLog = require('../models/HealthLog');
const EmotionLog = require('../models/EmotionLog');

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── GET /api/guardian/elder ───────────────────────────────────────────────────
const getLinkedElder = async (req, res) => {
    try {
        // Guardian schema stores elderId (ref to User)
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

        // Today's tasks
        const tasks = await Task.find({
            elderId,
            date: { $gte: todayStart, $lte: todayEnd }
        }).lean();

        const done = tasks.filter(t => t.status === 'done').length;
        const skipped = tasks.filter(t => t.status === 'skipped').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const refused = tasks.filter(t => t.status === 'refused').length;
        const total = tasks.length;
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

        // Today's latest mood
        const latestEmotion = await EmotionLog.findOne({
            elderId,
            date: { $gte: todayStart, $lte: todayEnd }
        }).sort({ updatedAt: -1 }).lean();

        // Today's health anomalies
        const anomalies = await HealthLog.find({
            elderId,
            timestamp: { $gte: todayStart, $lte: todayEnd },
            isAnomaly: true
        }).sort({ timestamp: -1 }).limit(10).lean();

        // Latest HR and SpO2 readings
        const [latestHRLog, latestSpO2Log] = await Promise.all([
            HealthLog.findOne({ elderId, type: 'hr' }).sort({ timestamp: -1 }).lean(),
            HealthLog.findOne({ elderId, type: 'spo2' }).sort({ timestamp: -1 }).lean()
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
                stats: { done, skipped, pending, refused, total, completionRate },
                moodScore: latestEmotion?.dailyMoodScore ?? null,
                moodLabel: latestEmotion?.sessions?.slice(-1)[0]?.moodLabel ?? null,
                anomalies,
                latestHR: latestHRLog?.value ?? null,
                latestSpO2: latestSpO2Log?.value ?? null
            }
        });
    } catch (err) {
        console.error('getLinkedElder error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/guardian/alerts?days=1&limit=20 ─────────────────────────────────
const getAlerts = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const days = parseInt(req.query.days) || 1;
        const limit = parseInt(req.query.limit) || 20;
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
            ...healthAlerts.map(a => ({
                _id: a._id,
                type: a.type === 'fall' ? 'fall_detected' : 'health_anomaly',
                anomalyReason: a.anomalyReason,
                value: { type: a.type, reading: a.value },
                timestamp: a.timestamp,
                isAnomaly: true
            })),
            ...emotionAlerts.map(a => ({
                _id: a._id,
                type: 'emotion_alert',
                concern: a.sessions?.find(s => s.concernFlag)?.moodLabel,
                moodScore: a.dailyMoodScore,
                timestamp: a.date,
                isAnomaly: true
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

// ── GET /api/guardian/history?days=30 ────────────────────────────────────────
const getHistory = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const elderId = guardian.elderId;
        const history = [];

        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);

            const [tasks, emotion] = await Promise.all([
                Task.find({ elderId, date: { $gte: dayStart, $lte: dayEnd } })
                    .select('status').lean(),
                EmotionLog.findOne({ elderId, date: { $gte: dayStart, $lte: dayEnd } })
                    .select('dailyMoodScore').sort({ updatedAt: -1 }).lean()
            ]);

            const done = tasks.filter(t => t.status === 'done').length;
            const total = tasks.length;

            if (total > 0 || emotion) {
                history.push({
                    date: dayStart,
                    completionRate: total > 0 ? Math.round((done / total) * 100) : null,
                    totalTasks: total,
                    doneTasks: done,
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

// ── GET /api/guardian/health-trend/:type?days=7 ──────────────────────────────
const getHealthTrend = async (req, res) => {
    try {
        const guardian = await User.findById(req.user._id).lean();
        if (!guardian?.elderId) {
            return res.status(404).json({ message: 'No elder linked' });
        }

        const { type } = req.params;
        const days = parseInt(req.query.days) || 7;
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

// ── PUT /api/guardian/elder/accessibility ────────────────────────────────────
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
    getHistory,
    getHealthTrend,
    updateElderAccessibility
};