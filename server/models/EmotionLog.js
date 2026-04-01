// FILE: server/models/EmotionLog.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    time: { type: Date, default: Date.now },
    question: { type: String, required: true },
    response: { type: String },
    voiceToneScore: { type: Number, min: 0, max: 10, default: 5 },
    sentimentScore: { type: Number, min: -1, max: 1, default: 0 },
    emotions: [String],
    moodLabel: {
        type: String,
        enum: ['happy', 'neutral', 'sad', 'anxious', 'confused'],
        default: 'neutral'
    },
    concernFlag: { type: Boolean, default: false }
});

const emotionLogSchema = new mongoose.Schema(
    {
        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        sessions: [sessionSchema],
        dailyMoodScore: { type: Number, min: 0, max: 10, default: 5 },
        summary: { type: String }
    },
    { timestamps: true }
);

emotionLogSchema.index({ elderId: 1, date: -1 });

module.exports = mongoose.model('EmotionLog', emotionLogSchema);