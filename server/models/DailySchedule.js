// FILE: server/models/DailySchedule.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    taskId: { type: String, required: true },
    type: {
        type: String,
        enum: ['water', 'medicine', 'exercise', 'meal', 'checkin', 'bp_report'],
        required: true
    },
    title: { type: String, required: true },
    scheduledTime: { type: String, required: true }, // "08:00"
    durationMinutes: { type: Number, default: 10 },
    instructions: { type: String },
    exerciseType: { type: String }, // only for exercise tasks
    status: {
        type: String,
        enum: ['pending', 'done', 'skipped', 'refused'],
        default: 'pending'
    },
    refusalReason: { type: String },
    completedAt: { type: Date },
    notes: { type: String }
});

const dailyScheduleSchema = new mongoose.Schema(
    {
        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        tasks: [taskSchema],
        generatedByAI: { type: Boolean, default: true }
    },
    { timestamps: true }
);

// Ensure one schedule per elder per day
dailyScheduleSchema.index({ elderId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailySchedule', dailyScheduleSchema);