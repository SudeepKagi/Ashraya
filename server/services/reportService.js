// FILE: server/services/reportService.js
const DailySchedule = require('../models/DailySchedule');
const DailyReport = require('../models/DailyReport');
const EmotionLog = require('../models/EmotionLog');
const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { generateDailyReportSummary } = require('./aiService');

const startOfDay = (date = new Date()) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};

const endOfDay = (date = new Date()) => {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
};

const getTaskStats = (tasks = []) => {
    const done = tasks.filter((t) => t.status === 'done').length;
    const total = tasks.length;
    const medicineTasks = tasks.filter((t) => t.type === 'medicine');
    const doneMedicine = medicineTasks.filter((t) => t.status === 'done').length;
    return {
        done,
        total,
        taskCompletion: total > 0 ? Math.round((done / total) * 100) : 0,
        medicineAdherence: medicineTasks.length > 0 ? Math.round((doneMedicine / medicineTasks.length) * 100) : 0,
        exerciseCompleted: tasks.some((t) => t.type === 'exercise' && t.status === 'done')
    };
};

const getMoodLabel = (score) => {
    if (score >= 8) return { label: 'Excellent', color: '#10b981', emoji: '😄' };
    if (score >= 6) return { label: 'Good', color: '#3b82f6', emoji: '🙂' };
    if (score >= 4) return { label: 'Fair', color: '#f59e0b', emoji: '😐' };
    return { label: 'Needs Attention', color: '#ef4444', emoji: '😔' };
};

const getAdherenceLabel = (pct) => {
    if (pct >= 90) return { label: 'Excellent', color: '#10b981' };
    if (pct >= 70) return { label: 'Good', color: '#3b82f6' };
    if (pct >= 50) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Poor', color: '#ef4444' };
};

const buildDonutSVG = (pct, color, size = 80) => {
    const r = 28, cx = 40, cy = 40;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 80 80">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
        stroke-dashoffset="${(circ / 4).toFixed(1)}"
        stroke-linecap="round"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle"
        font-size="13" font-weight="700" fill="#1f2937">${pct}%</text>
    </svg>`;
};

const buildBarChart = (tasks = []) => {
    const types = ['medicine', 'exercise', 'meal', 'water', 'other'];
    const colors = { medicine: '#8b5cf6', exercise: '#10b981', meal: '#f59e0b', water: '#3b82f6', other: '#6b7280' };
    const rows = types.map((type) => {
        const all = tasks.filter((t) => t.type === type);
        const done = all.filter((t) => t.status === 'done').length;
        const pct = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
        if (all.length === 0) return '';
        return `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;color:#374151;text-transform:capitalize">${type}</span>
            <span style="font-size:13px;font-weight:600;color:${colors[type]}">${done}/${all.length}</span>
          </div>
          <div style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden">
            <div style="width:${pct}%;background:${colors[type]};height:100%;border-radius:999px;transition:width 0.3s"></div>
          </div>
        </div>`;
    });
    return rows.join('');
};

const buildMoodTimeline = (sessions = []) => {
    if (!sessions.length) return '<p style="color:#9ca3af;font-size:13px">No emotion sessions recorded today.</p>';
    return sessions.map((s) => {
        const time = new Date(s.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const moodColors = { happy: '#10b981', sad: '#ef4444', neutral: '#6b7280', anxious: '#f59e0b', tired: '#8b5cf6' };
        const dot = moodColors[s.mood] || '#6b7280';
        return `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
          <div style="min-width:36px;text-align:center">
            <div style="width:12px;height:12px;border-radius:50%;background:${dot};margin:4px auto"></div>
            <span style="font-size:10px;color:#9ca3af">${time}</span>
          </div>
          <div style="background:#f9fafb;border-left:3px solid ${dot};padding:8px 12px;border-radius:0 8px 8px 0;flex:1">
            <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:500">${s.question || 'Check-in'}</p>
            <p style="margin:0;font-size:12px;color:#6b7280">${s.response || 'No response recorded'}</p>
          </div>
        </div>`;
    }).join('');
};

const buildTaskTable = (tasks = []) => {
    if (!tasks.length) return '<p style="color:#9ca3af;font-size:13px">No tasks scheduled today.</p>';
    const statusIcon = { done: '✅', pending: '⏳', skipped: '❌', snoozed: '🔁' };
    const typeColor = { medicine: '#8b5cf6', exercise: '#10b981', meal: '#f59e0b', water: '#3b82f6', other: '#6b7280' };
    return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Time</th>
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Task</th>
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Type</th>
          <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map((t, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">
          <td style="padding:10px 12px;color:#6b7280;border-bottom:1px solid #f3f4f6">${t.scheduledTime || '--'}</td>
          <td style="padding:10px 12px;color:#1f2937;font-weight:500;border-bottom:1px solid #f3f4f6">${t.title}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">
            <span style="background:${typeColor[t.type] || '#6b7280'}20;color:${typeColor[t.type] || '#6b7280'};
              padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:capitalize">
              ${t.type}
            </span>
          </td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6">
            ${statusIcon[t.status] || '❓'}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
};

const buildHealthAlerts = (healthLogs = []) => {
    if (!healthLogs.length) return `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <span style="font-size:20px">✅</span>
      <p style="margin:0;color:#166534;font-size:13px;font-weight:500">No health alerts today. All vitals normal.</p>
    </div>`;

    return healthLogs.map((log) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;margin-bottom:8px">
      <span style="font-size:18px;margin-top:2px">⚠️</span>
      <div>
        <p style="margin:0 0 2px;color:#991b1b;font-size:13px;font-weight:600">
          ${new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style="margin:0;color:#7f1d1d;font-size:12px">${log.anomalyReason || `${log.type} anomaly detected`}</p>
      </div>
    </div>`).join('');
};

const buildReportHtml = ({ elder, report, schedule, emotionLog, healthLogs }) => {
    const tasks = schedule?.tasks || [];
    const sessions = emotionLog?.sessions || [];
    const mood = getMoodLabel(report.moodScore);
    const adherence = getAdherenceLabel(report.taskCompletion);
    const date = new Date(report.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AASHRAYA — Daily Care Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; color: #1f2937; }
    .page { max-width: 860px; margin: 0 auto; padding: 32px 16px; }
    .card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    h2 { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    @media print { body { background: white; } .page { padding: 0; } }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:20px;padding:28px 32px;margin-bottom:20px;color:white">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:13px;opacity:0.8;margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Daily Care Report</div>
        <h1 style="font-size:26px;font-weight:700;margin-bottom:4px">🌿 AASHRAYA</h1>
        <p style="opacity:0.85;font-size:14px">${elder.name} &nbsp;·&nbsp; Age ${elder.age || 'N/A'}</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;opacity:0.75">${date}</div>
        <div style="margin-top:8px;background:rgba(255,255,255,0.15);border-radius:10px;padding:6px 14px;font-size:13px;font-weight:600">
          Overall: ${adherence.label}
        </div>
      </div>
    </div>
  </div>

  <!-- METRIC CARDS -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px">

    <div class="card" style="text-align:center;border-top:4px solid #4f46e5">
      ${buildDonutSVG(report.taskCompletion, '#4f46e5')}
      <p style="margin-top:8px;font-size:13px;font-weight:600;color:#374151">Task Completion</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:2px">${schedule?.tasks?.filter(t => t.status === 'done').length || 0} of ${schedule?.tasks?.length || 0} tasks</p>
    </div>

    <div class="card" style="text-align:center;border-top:4px solid ${mood.color}">
      <div style="font-size:42px;margin:6px 0">${mood.emoji}</div>
      <p style="font-size:22px;font-weight:700;color:${mood.color}">${report.moodScore}<span style="font-size:13px;color:#9ca3af">/10</span></p>
      <p style="font-size:13px;font-weight:600;color:#374151">Mood Score</p>
      <p style="font-size:12px;color:${mood.color};margin-top:2px">${mood.label}</p>
    </div>

    <div class="card" style="text-align:center;border-top:4px solid #8b5cf6">
      ${buildDonutSVG(report.medicineAdherence, '#8b5cf6')}
      <p style="margin-top:8px;font-size:13px;font-weight:600;color:#374151">Medicine Adherence</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:2px">${getAdherenceLabel(report.medicineAdherence).label}</p>
    </div>

    <div class="card" style="text-align:center;border-top:4px solid #10b981">
      <div style="font-size:42px;margin:12px 0">${report.exerciseCompleted ? '🏃' : '🛋️'}</div>
      <p style="font-size:15px;font-weight:700;color:${report.exerciseCompleted ? '#10b981' : '#ef4444'}">
        ${report.exerciseCompleted ? 'Completed' : 'Not Done'}
      </p>
      <p style="font-size:13px;font-weight:600;color:#374151;margin-top:4px">Exercise</p>
    </div>

  </div>

  <!-- AI SUMMARY -->
  <div class="card" style="border-left:5px solid #4f46e5">
    <h2>🤖 AI Summary</h2>
    <p style="font-size:14px;line-height:1.7;color:#374151">${report.aiSummary || 'No summary available.'}</p>
  </div>

  <!-- TASK BREAKDOWN BAR CHART -->
  <div class="card">
    <h2>📊 Task Breakdown by Category</h2>
    ${buildBarChart(tasks)}
  </div>

  <!-- TASK TABLE -->
  <div class="card">
    <h2>📋 Task Schedule</h2>
    ${buildTaskTable(tasks)}
  </div>

  <!-- HEALTH ALERTS -->
  <div class="card">
    <h2>❤️ Health Alerts</h2>
    ${buildHealthAlerts(healthLogs)}
  </div>

  <!-- MOOD TIMELINE -->
  <div class="card">
    <h2>💬 Emotion Check-ins</h2>
    ${buildMoodTimeline(sessions)}
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
    Generated by AASHRAYA Elder Care System &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN')}
    ${report.sentToGuardian ? '<br><span style="color:#10b981;font-weight:600">✅ Sent to guardian</span>' : ''}
  </div>

</div>
</body>
</html>`;
};

const buildReportUrl = (reportId) => `/api/report/pdf/${reportId}`;

const generateDailyReport = async (elderId, reportDate = new Date()) => {
    const dateStart = startOfDay(reportDate);
    const dateEnd = endOfDay(reportDate);

    const [elder, schedule, emotionLog, healthLogs] = await Promise.all([
        User.findById(elderId).select('name age profile guardianId'),
        DailySchedule.findOne({ elderId, date: { $gte: dateStart, $lte: dateEnd } }).lean(),
        EmotionLog.findOne({ elderId, date: { $gte: dateStart, $lte: dateEnd } }).sort({ updatedAt: -1 }).lean(),
        HealthLog.find({ elderId, timestamp: { $gte: dateStart, $lte: dateEnd }, isAnomaly: true }).sort({ timestamp: -1 }).lean()
    ]);

    if (!elder) throw new Error('Elder not found');

    const stats = getTaskStats(schedule?.tasks || []);
    const moodScore = Number((emotionLog?.dailyMoodScore ?? elder.baselineMoodScore ?? 5).toFixed?.(1) || 5);
    const aiSummary = await generateDailyReportSummary({ elder, schedule: schedule || { tasks: [] }, emotionLog, healthLogs });

    let report = await DailyReport.findOne({ elderId, date: { $gte: dateStart, $lte: dateEnd } });
    if (!report) report = new DailyReport({ elderId, date: dateStart });

    report.taskCompletion = stats.taskCompletion;
    report.medicineAdherence = stats.medicineAdherence;
    report.exerciseCompleted = stats.exerciseCompleted;
    report.moodScore = Number.isFinite(moodScore) ? moodScore : 5;
    report.healthAlerts = healthLogs.map((l) => l.anomalyReason || `${l.type} anomaly`);
    report.aiSummary = aiSummary;
    report.sentToGuardian = Boolean(elder.guardianId);

    await report.save();
    report.reportUrl = buildReportUrl(report._id);
    await report.save();

    return { report, elder, schedule, emotionLog, healthLogs, html: buildReportHtml({ elder, report, schedule, emotionLog, healthLogs }) };
};

const getReportHistory = async (elderId, limit = 14) => {
    return DailyReport.find({ elderId }).sort({ date: -1 }).limit(limit).lean();
};

module.exports = { generateDailyReport, getReportHistory };