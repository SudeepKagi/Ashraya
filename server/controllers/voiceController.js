// FILE: server/controllers/voiceController.js
const OpenAI = require('openai');
const { toFile } = require('openai/uploads');
const User = require('../models/User');
const DailySchedule = require('../models/DailySchedule');
const { generateVoiceCompanionReply } = require('../services/aiService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transcribeAudio = async (req, res) => {
    try {
        const { audioBase64, mimeType = 'audio/webm', language = 'en' } = req.body;

        if (!audioBase64) {
            return res.status(400).json({ message: 'audioBase64 is required' });
        }

        const buffer = Buffer.from(audioBase64, 'base64');
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
        const file = await toFile(buffer, `voice-input.${extension}`, { type: mimeType });

        const result = await openai.audio.transcriptions.create({
            file,
            model: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
            language
        });

        return res.json({ text: result.text || '' });
    } catch (err) {
        console.error('transcribeAudio error:', err.message);
        const status = err.status === 429 ? 429 : 500;
        const message = err.status === 429
            ? 'Voice transcription quota exceeded'
            : 'Failed to transcribe audio';
        return res.status(status).json({ message });
    }
};

const respondToElder = async (req, res) => {
    try {
        const { query, moodSignals = [] } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'query is required' });
        }

        const elder = await User.findById(req.user._id).select('name');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch full schedule so AI has complete context
        const schedule = await DailySchedule.findOne({
            elderId: req.user._id,
            date: today
        }).lean();

        const pendingTasks = schedule?.tasks?.filter(t => t.status === 'pending') || [];
        const nextTask = pendingTasks.sort(
            (a, b) => String(a.scheduledTime).localeCompare(String(b.scheduledTime))
        )[0] || null;

        let reply;
        try {
            reply = await generateVoiceCompanionReply({
                elderName: elder?.name,
                query,
                nextTask,
                moodSignals,
                pendingCount: pendingTasks.length,
                schedule  // full schedule for rich context
            });
        } catch (err) {
            console.warn('respondToElder AI fallback used:', err.message);
            reply = nextTask
                ? `I am here with you. Your next task is ${nextTask.title} at ${nextTask.scheduledTime}.`
                : 'I am here with you. You are doing well today.';
        }

        return res.json({ reply, nextTask });
    } catch (err) {
        console.error('respondToElder error:', err.message);
        return res.status(500).json({ message: 'Failed to generate voice reply' });
    }
};

module.exports = { transcribeAudio, respondToElder };
