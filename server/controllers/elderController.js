// FILE: server/controllers/elderController.js
const User = require('../models/User');

// @route GET /api/elder/profile
const getProfile = async (req, res, next) => {
    try {
        const elder = await User.findById(req.user._id).select('-password');
        res.json({ success: true, elder });
    } catch (err) {
        next(err);
    }
};

// @route PUT /api/elder/profile
const updateProfile = async (req, res, next) => {
    try {
        const allowed = ['name', 'preferredLanguage', 'profile', 'accessibility', 'baseline', 'fcmToken'];
        const updates = {};
        allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

        const elder = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        res.json({ success: true, elder });
    } catch (err) {
        next(err);
    }
};

// @route GET /api/elder/dashboard  — aggregated data for dashboard
const getDashboard = async (req, res, next) => {
    try {
        const elder = await User.findById(req.user._id).select('-password');
        res.json({ success: true, elder });
    } catch (err) {
        next(err);
    }
};

module.exports = { getProfile, updateProfile, getDashboard };