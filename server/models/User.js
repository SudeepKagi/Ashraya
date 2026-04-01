// FILE: server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    times: [String]
});

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        age: { type: Number },
        gender: { type: String, enum: ['male', 'female', 'other'] },
        phone: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, enum: ['elder', 'guardian'], required: true },
        preferredLanguage: { type: String, default: 'en' },

        guardianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        profile: {
            diseases: [String],
            ongoingTreatments: [String],
            medicines: [medicineSchema],
            doctorName: String,
            doctorContact: String,
            emergencyContact: { name: String, phone: String }
        },
        accessibility: {
            hearingImpaired: { type: Boolean, default: false },
            visionImpaired: { type: Boolean, default: false },
            mobilityImpaired: { type: Boolean, default: false },
            cognitiveIssues: { type: Boolean, default: false }
        },
        baseline: {
            restingHR: Number,
            avgSpO2: Number,
            baselineMoodScore: Number
        },

        elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        fcmToken: { type: String }
    },
    { timestamps: true }
);

// ✅ Fixed: bcryptjs v3 requires async/await — callbacks were removed
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);