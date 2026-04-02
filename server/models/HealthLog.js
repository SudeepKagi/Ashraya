// FILE: server/models/HealthLog.js
const mongoose = require('mongoose');

const healthLogSchema = new mongoose.Schema(
    {
        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now },
        type: {
            type: String,
            enum: ['hr', 'spo2', 'fall', 'sos', 'bp', 'steps', 'accelerometer', 'medicine_supply'],
            required: true
        },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        isAnomaly: { type: Boolean, default: false },
        anomalyReason: { type: String, default: null },
        alertSent: { type: Boolean, default: false },
        isRead: { type: Boolean, default: false },
        notes: { type: String }
    },
    { timestamps: true }
);

healthLogSchema.index({ elderId: 1, timestamp: -1 });

module.exports = mongoose.model('HealthLog', healthLogSchema);
