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
    const colors = { medicine: '#7c3aed', exercise: '#10b981', meal: '#f59e0b', water: '#3b82f6', other: '#6b7280' };
    const rows = types.map((type) => {
        const all = tasks.filter((t) => t.type === type);
        const done = all.filter((t) => t.status === 'done').length;
        const pct = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
        if (all.length === 0) return '';
        return `
        <div class="bar-row">
          <span class="bar-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[type]}"></div></div>
          <span class="bar-stat" style="color:${colors[type]}">${done}/${all.length}</span>
        </div>`;
    });
    return rows.join('') || '<p style="color:#9ca3af;font-size:13px">No tasks recorded.</p>';
};

const buildMoodTimeline = (sessions = []) => {
    if (!sessions.length) return '<p style="color:#9ca3af;font-size:13px">No emotion sessions recorded today.</p>';
    return sessions.map((s) => {
        const time = new Date(s.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const moodColors = { happy: '#10b981', sad: '#ef4444', neutral: '#6b7280', anxious: '#f59e0b', tired: '#8b5cf6', confused: '#f59e0b' };
        const dot = moodColors[s.moodLabel] || '#6b7280';
        const sentLine = s.sentimentScore != null
            ? `<span style="font-size:10px;color:#9ca3af">Sentiment: ${(s.sentimentScore >= 0 ? '+' : '')}${s.sentimentScore?.toFixed(2)}</span>`
            : '';
        return `
        <div class="mood-item">
          <div style="min-width:44px;text-align:center">
            <div class="mood-dot" style="background:${dot};margin:0 auto"></div>
            <p style="font-size:10px;color:#9ca3af;margin-top:3px">${time}</p>
          </div>
          <div class="mood-card" style="border-left-color:${dot}">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${dot};text-transform:capitalize">${s.moodLabel || 'neutral'} ${sentLine}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:500">${s.question || 'Emotion Check-in'}</p>
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
    <div class="alert-ok">
      <span style="font-size:18px">✓</span>
      <p style="margin:0;color:#166534;font-size:13px;font-weight:500">No health alerts today. All monitored vitals within normal range.</p>
    </div>`;

    return healthLogs.map((log) => `
    <div class="alert-row">
      <span style="font-size:17px;margin-top:2px">⚠</span>
      <div>
        <p style="margin:0 0 3px;color:#991b1b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">
          ${new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style="margin:0;color:#7f1d1d;font-size:13px">${log.anomalyReason || `${log.type} anomaly detected`}</p>
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
  <title>ASHRAYA — Daily Care Report · ${elder.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f0; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
    .page { max-width: 820px; margin: 32px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }

    /* ─── Header bar ─── */
    .report-header { background: #006d6d; color: white; padding: 28px 36px; }
    .report-header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
    .report-brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.75; margin-bottom: 6px; }
    .report-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .report-subtitle { font-size: 13px; opacity: 0.85; margin-top: 4px; }
    .report-meta { text-align: right; }
    .report-date { font-size: 13px; opacity: 0.85; }
    .report-badge { display: inline-block; margin-top: 8px; padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1.5px solid rgba(255,255,255,0.5); background: rgba(255,255,255,0.12); }

    /* ─── Info strip ─── */
    .info-strip { background: #f0fafa; border-bottom: 2px solid #e0f0f0; padding: 14px 36px; display: flex; gap: 32px; flex-wrap: wrap; }
    .info-item label { font-size: 10px; color: #006d6d; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 13px; font-weight: 600; color: #1a1a1a; }

    /* ─── Body ─── */
    .report-body { padding: 28px 36px; }

    /* ─── Section heading ─── */
    .section-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #006d6d; padding-bottom: 8px; border-bottom: 1.5px solid #e0f0f0; margin-bottom: 16px; margin-top: 28px; }
    .section-heading:first-child { margin-top: 0; }

    /* ─── Metric cards ─── */
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 4px; }
    .metric-card { border-radius: 10px; padding: 16px 14px; text-align: center; border: 1px solid #e5e7eb; }
    .metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
    .metric-value { font-size: 20px; font-weight: 700; line-height: 1.1; }
    .metric-sub { font-size: 11px; color: #6b7280; margin-top: 4px; }

    /* ─── AI summary ─── */
    .ai-summary-box { background: #f0fafa; border-left: 4px solid #006d6d; border-radius: 0 10px 10px 0; padding: 16px 20px; font-size: 13.5px; line-height: 1.75; color: #1f2937; }

    /* ─── Bar chart ─── */
    .bar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .bar-row .bar-label { width: 90px; font-size: 12px; color: #374151; flex-shrink: 0; text-transform: capitalize; }
    .bar-row .bar-track { flex: 1; background: #e5e7eb; border-radius: 999px; height: 10px; overflow: hidden; }
    .bar-row .bar-fill  { height: 100%; border-radius: 999px; }
    .bar-row .bar-stat  { width: 46px; font-size: 12px; font-weight: 600; text-align: right; flex-shrink: 0; }

    /* ─── Table ─── */
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { padding: 10px 12px; text-align: left; color: #6b7280; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; background: #f9fafb; border-bottom: 1.5px solid #e5e7eb; }
    td { padding: 10px 12px; color: #1f2937; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }
    .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: capitalize; }

    /* ─── Health alerts ─── */
    .alert-ok  { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; }
    .alert-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: #fef2f2; border-radius: 10px; border: 1px solid #fecaca; margin-bottom: 8px; }

    /* ─── Mood timeline ─── */
    .mood-item { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
    .mood-dot  { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .mood-card { flex: 1; background: #f9fafb; border-left: 3px solid #e5e7eb; border-radius: 0 8px 8px 0; padding: 10px 14px; }

    /* ─── Footer ─── */
    .report-footer { margin-top: 32px; padding: 20px 36px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
    .footer-brand { font-size: 13px; font-weight: 700; color: #006d6d; }
    .footer-meta  { font-size: 11px; color: #9ca3af; line-height: 1.6; text-align: right; }
    .confidential { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #9ca3af; text-transform: uppercase; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px; text-align: center; }

    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="report-header">
    <div class="report-header-top">
      <div>
        <p class="report-brand">Ashraya Elder Care System</p>
        <h1 class="report-title">Daily Care Report</h1>
        <p class="report-subtitle">${elder.name}&nbsp;&nbsp;|&nbsp;&nbsp;Age ${elder.age || 'N/A'}</p>
      </div>
      <div class="report-meta">
        <p class="report-date">${date}</p>
        <span class="report-badge">Overall: ${adherence.label}</span>
      </div>
    </div>
  </div>

  <!-- INFO STRIP -->
  <div class="info-strip">
    <div class="info-item"><label>Report Date</label><span>${date}</span></div>
    <div class="info-item"><label>Conditions</label><span>${elder.profile?.diseases?.join(', ') || 'None recorded'}</span></div>
    <div class="info-item"><label>Report Type</label><span>AI-Generated Daily Summary</span></div>
    <div class="info-item"><label>Sent to Guardian</label><span>${report.sentToGuardian ? 'Yes' : 'No'}</span></div>
  </div>

  <div class="report-body">

    <!-- METRICS -->
    <p class="section-heading">Health Metrics Overview</p>
    <div class="metrics-grid">

      <div class="metric-card" style="border-top: 3px solid #006d6d;">
        ${buildDonutSVG(report.taskCompletion, '#006d6d')}
        <p class="metric-label" style="margin-top:8px">Task Completion</p>
        <p class="metric-sub">${schedule?.tasks?.filter(t => t.status === 'done').length || 0} of ${schedule?.tasks?.length || 0} tasks</p>
      </div>

      <div class="metric-card" style="border-top: 3px solid ${mood.color};">
        <div style="font-size:40px;margin:6px 0">${mood.emoji}</div>
        <div class="metric-value" style="color:${mood.color}">${report.moodScore}<span style="font-size:13px;color:#9ca3af">/10</span></div>
        <p class="metric-label" style="margin-top:8px">Mood Score</p>
        <p class="metric-sub" style="color:${mood.color}">${mood.label}</p>
      </div>

      <div class="metric-card" style="border-top: 3px solid #7c3aed;">
        ${buildDonutSVG(report.medicineAdherence, '#7c3aed')}
        <p class="metric-label" style="margin-top:8px">Medicine Adherence</p>
        <p class="metric-sub">${getAdherenceLabel(report.medicineAdherence).label}</p>
      </div>

      <div class="metric-card" style="border-top: 3px solid ${report.exerciseCompleted ? '#10b981' : '#ef4444'};">
        <div style="font-size:40px;margin:12px 0">${report.exerciseCompleted ? '🏃' : '🛋️'}</div>
        <div class="metric-value" style="font-size:15px;color:${report.exerciseCompleted ? '#10b981' : '#ef4444'}">${report.exerciseCompleted ? 'Completed' : 'Not Done'}</div>
        <p class="metric-label" style="margin-top:8px">Exercise</p>
      </div>

    </div>

    <!-- AI SUMMARY -->
    <p class="section-heading" style="margin-top:28px">AI-Generated Care Summary</p>
    <div class="ai-summary-box">${report.aiSummary || 'No summary available for this report.'}</div>

    <!-- TASK BREAKDOWN -->
    <p class="section-heading">Task Completion by Category</p>
    ${buildBarChart(tasks)}

    <!-- TASK TABLE -->
    <p class="section-heading">Full Task Schedule</p>
    ${buildTaskTable(tasks)}

    <!-- HEALTH ALERTS -->
    <p class="section-heading">Health & Safety Alerts</p>
    ${buildHealthAlerts(healthLogs)}

    <!-- MOOD TIMELINE -->
    <p class="section-heading">Emotion Check-in Timeline</p>
    ${buildMoodTimeline(sessions)}

  </div>

  <!-- FOOTER -->
  <div class="report-footer">
    <div>
      <p class="footer-brand">🌿 ASHRAYA</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:3px">Intelligent Elder Care Platform</p>
    </div>
    <div class="footer-meta">
      Generated: ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br/>
      ${report.sentToGuardian ? '<span style="color:#10b981;font-weight:600">✓ Delivered to Guardian</span>' : 'Guardian delivery: Pending'}
    </div>
  </div>
  <p class="confidential">Confidential — For Authorised Caregivers Only · Ashraya Elder Care System</p>

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