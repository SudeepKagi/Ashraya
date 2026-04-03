// FILE: server/controllers/emotionController.js
const EmotionLog = require('../models/EmotionLog');
const User = require('../models/User');
const { analyseEmotion } = require('../services/aiService');

// @route POST /api/emotion/checkin
// Save one emotion session + run AI analysis
const saveCheckin = async (req, res, next) => {
    try {
        const { question, response: userResponse, voiceToneScore = 5 } = req.body;

        if (!question || !userResponse) {
            return res.status(400).json({ success: false, message: 'question and response are required' });
        }

        const elder = await User.findById(req.user._id);

        // Run NLP analysis via OpenAI
        let analysis = { sentimentScore: 0, emotions: [], moodLabel: 'neutral', concernFlag: false, summary: userResponse };
        try {
            analysis = await analyseEmotion({
                question, response: userResponse, language: elder.preferredLanguage || 'en'
            });
        } catch (aiErr) {
            console.warn('AI emotion analysis failed, using defaults:', aiErr.message);
        }

        const session = {
            time: new Date(),
            question,
            response: userResponse,
            voiceToneScore,
            sentimentScore: analysis.sentimentScore,
            emotions: analysis.emotions,
            moodLabel: analysis.moodLabel,
            concernFlag: analysis.concernFlag
        };

        // Find or create today's emotion log
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let log = await EmotionLog.findOne({ elderId: elder._id, date: today });

        if (log) {
            log.sessions.push(session);
        } else {
            log = new EmotionLog({ elderId: elder._id, date: today, sessions: [session] });
        }

        // Recalculate daily mood score from all sessions
        // AI sentiment score: -1 → 1 mapped to 0 → 10 scale
        // Voice tone (0–10) acts as a 20% modifier
        const avgSentiment = log.sessions.reduce((s, sess) => s + sess.sentimentScore, 0) / log.sessions.length;
        const avgVoice = log.sessions.reduce((s, sess) => s + (sess.voiceToneScore ?? 5), 0) / log.sessions.length;
        // 80% weight on NLP sentiment, 20% on voice tone
        const sentimentMapped = (avgSentiment + 1) * 5; // maps [-1,1] → [0,10]
        const rawScore = sentimentMapped * 0.8 + avgVoice * 0.2;
        log.dailyMoodScore = Math.min(10, Math.max(1, parseFloat(rawScore.toFixed(1))));

        await log.save();

        // Alert guardian if concern flagged
        if (analysis.concernFlag && elder.guardianId) {
            req.io.to(elder.guardianId.toString()).emit('emotion_alert', {
                elderId: elder._id,
                elderName: elder.name,
                moodScore: log.dailyMoodScore,
                concern: analysis.summary,
                timestamp: new Date()
            });
        }

        res.json({ success: true, session, analysis, dailyMoodScore: log.dailyMoodScore });
    } catch (err) {
        next(err);
    }
};

// @route GET /api/emotion/today
const getToday = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const log = await EmotionLog.findOne({ elderId: req.user._id, date: today });
        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
};

// @route GET /api/emotion/trend/:elderId
const getTrend = async (req, res, next) => {
    try {
        const elderId = req.params.elderId || req.user._id;
        const logs = await EmotionLog.find({ elderId })
            .sort({ date: -1 })
            .limit(7)
            .select('date dailyMoodScore sessions');
        res.json({ success: true, logs });
    } catch (err) {
        next(err);
    }
};

module.exports = { saveCheckin, getToday, getTrend };