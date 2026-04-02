// FILE: server/controllers/reportController.js
const DailyReport = require('../models/DailyReport');
const User = require('../models/User');
const { generateDailyReport, getReportHistory } = require('../services/reportService');

const resolveTargetElderId = async (req) => {
    if (req.user.role === 'elder') return req.user._id;
    if (req.params.elderId) return req.params.elderId;
    const guardian = await User.findById(req.user._id).select('elderId');
    if (!guardian?.elderId) throw new Error('No elder linked to this guardian account');
    return guardian.elderId;
};

const getTodayReport = async (req, res) => {
    try {
        const elderId = await resolveTargetElderId(req);
        const payload = await generateDailyReport(elderId, new Date());
        res.json({ report: payload.report });
    } catch (err) {
        res.status(400).json({ message: err.message || 'Failed to fetch report' });
    }
};

const getHistory = async (req, res) => {
    try {
        const elderId = await resolveTargetElderId(req);
        const reports = await getReportHistory(elderId, Number(req.query.limit || 14));
        res.json({ reports });
    } catch (err) {
        res.status(400).json({ message: err.message || 'Failed to fetch report history' });
    }
};

const generateReport = async (req, res) => {
    try {
        const elderId = await resolveTargetElderId(req);
        const date = req.body?.date ? new Date(req.body.date) : new Date();
        const payload = await generateDailyReport(elderId, date);
        res.status(201).json({ message: 'Daily report generated successfully', report: payload.report });
    } catch (err) {
        res.status(400).json({ message: err.message || 'Failed to generate report' });
    }
};

const getReportPdf = async (req, res) => {
    try {
        const report = await DailyReport.findById(req.params.reportId).lean();
        if (!report) return res.status(404).json({ message: 'Report not found' });
        const payload = await generateDailyReport(report.elderId, report.date);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(payload.html);
    } catch (err) {
        res.status(400).json({ message: err.message || 'Failed to render report' });
    }
};

module.exports = { getTodayReport, getHistory, generateReport, getReportPdf };