// FILE: server/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// @route  POST /api/auth/elder/register
const registerElder = async (req, res, next) => {
    try {
        const {
            name, age, gender, phone, email, password, preferredLanguage,
            diseases, ongoingTreatments, medicines, doctorName, doctorContact,
            emergencyContact, accessibility, guardianPhone
        } = req.body;

        // Check for existing user
        const existing = await User.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email or phone already registered' });
        }

        // If guardianPhone provided, look up guardian
        let guardianId = null;
        if (guardianPhone) {
            const guardian = await User.findOne({ phone: guardianPhone, role: 'guardian' });
            if (guardian) guardianId = guardian._id;
        }

        const elder = await User.create({
            name, age, gender, phone, email, password,
            role: 'elder',
            preferredLanguage: preferredLanguage || 'en',
            guardianId,
            profile: {
                diseases: diseases || [],
                ongoingTreatments: ongoingTreatments || [],
                medicines: medicines || [],
                doctorName, doctorContact,
                emergencyContact
            },
            accessibility: accessibility || {}
        });

        // If guardian was found, link elder to guardian too
        if (guardianId) {
            await User.findByIdAndUpdate(guardianId, { elderId: elder._id });
        }

        const token = generateToken(elder._id);
        res.status(201).json({
            success: true,
            token,
            user: { id: elder._id, name: elder.name, role: elder.role, email: elder.email }
        });
    } catch (err) {
        next(err);
    }
};

// @route  POST /api/auth/guardian/register
const registerGuardian = async (req, res, next) => {
    try {
        const { name, phone, email, password, elderPhone } = req.body;

        const existing = await User.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email or phone already registered' });
        }

        // If elderPhone provided, look up elder
        let elderId = null;
        if (elderPhone) {
            const elder = await User.findOne({ phone: elderPhone, role: 'elder' });
            if (elder) elderId = elder._id;
        }

        const guardian = await User.create({
            name, phone, email, password,
            role: 'guardian',
            elderId
        });

        // Link back to elder
        if (elderId) {
            await User.findByIdAndUpdate(elderId, { guardianId: guardian._id });
        }

        const token = generateToken(guardian._id);
        res.status(201).json({
            success: true,
            token,
            user: { id: guardian._id, name: guardian.name, role: guardian.role, email: guardian.email }
        });
    } catch (err) {
        next(err);
    }
};

// @route  POST /api/auth/login
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, role: user.role, email: user.email }
        });
    } catch (err) {
        next(err);
    }
};

// @route  GET /api/auth/me
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

module.exports = { registerElder, registerGuardian, login, getMe };