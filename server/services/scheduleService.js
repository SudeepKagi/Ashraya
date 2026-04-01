// FILE: server/services/scheduleService.js
const DailySchedule = require('../models/DailySchedule');
const { generateDailySchedule } = require('./aiService');

/**
 * Get today's schedule for an elder.
 * If no schedule exists yet, generate one via AI and save it.
 */
const getTodaySchedule = async (elder) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to find existing schedule for today
    let schedule = await DailySchedule.findOne({ elderId: elder._id, date: today });
    if (schedule) return schedule;

    // None found — generate via AI
    const tasks = await generateDailySchedule(elder);

    schedule = await DailySchedule.create({
        elderId: elder._id,
        date: today,
        tasks,
        generatedByAI: true
    });

    return schedule;
};

/**
 * Update a single task's status inside today's schedule
 */
const updateTaskStatus = async (elderId, taskId, update) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedule = await DailySchedule.findOne({ elderId, date: today });
    if (!schedule) throw new Error('No schedule found for today');

    const task = schedule.tasks.find(t => t.taskId === taskId);
    if (!task) throw new Error('Task not found');

    task.status = update.status || task.status;
    if (update.status === 'done') task.completedAt = new Date();
    if (update.refusalReason) task.refusalReason = update.refusalReason;
    if (update.notes) task.notes = update.notes;

    await schedule.save();
    return { schedule, task };
};

/**
 * Calculate completion stats for a schedule
 */
const getCompletionStats = (schedule) => {
    const total = schedule.tasks.length;
    const done = schedule.tasks.filter(t => t.status === 'done').length;
    const pending = schedule.tasks.filter(t => t.status === 'pending').length;
    const skipped = schedule.tasks.filter(t => t.status === 'skipped').length;
    const refused = schedule.tasks.filter(t => t.status === 'refused').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, skipped, refused, completionRate };
};

module.exports = { getTodaySchedule, updateTaskStatus, getCompletionStats };