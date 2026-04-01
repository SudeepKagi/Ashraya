// FILE: server/models/DailyReport.js
const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
    {
        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        taskCompletion: { type: Number, min: 0, max: 100, default: 0 }, // percentage
        moodScore: { type: Number, min: 0, max: 10, default: 5 },
        healthAlerts: [String],
        medicineAdherence: { type: Number, min: 0, max: 100, default: 0 },
        exerciseCompleted: { type: Boolean, default: false },
        aiSummary: { type: String },
        reportUrl: { type: String },
        sentToGuardian: { type: Boolean, default: false },
        sentToDoctor: { type: Boolean, default: false }
    },
    { timestamps: true }
);

dailyReportSchema.index({ elderId: 1, date: -1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);