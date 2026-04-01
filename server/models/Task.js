// FILE: server/models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailySchedule' },
        date: { type: Date, required: true },          // date-only (midnight UTC)
        scheduledTime: { type: String, required: true }, // "08:00"
        type: {
            type: String,
            enum: ['water', 'medicine', 'exercise', 'meal', 'checkin', 'bp_report', 'custom'],
            required: true
        },
        title: { type: String, required: true },
        instructions: { type: String },
        exerciseType: { type: String },                // if type === 'exercise'
        medicineDetails: {                             // if type === 'medicine'
            name: String,
            dosage: String
        },
        status: {
            type: String,
            enum: ['pending', 'done', 'skipped', 'refused'],
            default: 'pending'
        },
        refusalReason: { type: String },
        completedAt: { type: Date },
        notes: { type: String }
    },
    { timestamps: true }
);

// Index for fetching today's tasks quickly
taskSchema.index({ elderId: 1, date: 1 });
taskSchema.index({ elderId: 1, date: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);