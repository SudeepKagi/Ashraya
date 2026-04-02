// FILE: client/src/components/guardian/ElderSummaryCard.jsx
const HeartIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.57z" />
    </svg>
);

const OxygenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2v10" />
        <path d="M8 6c0-2.2 1.8-4 4-4s4 1.8 4 4c0 5-4 6-4 10" />
        <path d="M6 18a3 3 0 1 0 6 0c0-1.9-1.2-3.2-3-5-1.8 1.8-3 3.1-3 5Z" />
    </svg>
);

const PressureIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 3v6" />
        <path d="M9 6h6" />
        <path d="M7 21h10" />
        <path d="M8 9h8l1 4.5A5.5 5.5 0 0 1 11.6 20H12a5.5 5.5 0 0 1-5.4-6.5L8 9Z" />
    </svg>
);

const ClipboardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
    </svg>
);

const MoodIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 10h.01" />
        <path d="M16 10h.01" />
        <path d="M8 15c1.2 1 2.4 1.5 4 1.5s2.8-.5 4-1.5" />
    </svg>
);

const AlertIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.3 1.82 18a2 2 0 0 0 1.74 3h16.88a2 2 0 0 0 1.74-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
    </svg>
);

const BaselineIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 12h4l2-5 4 10 2-5h4" />
    </svg>
);

const sparkline = (values = []) => {
    const safe = values.length ? values : [40, 42, 41, 43, 45, 44];
    return safe.map((value, index) => {
        const x = safe.length === 1 ? 44 : (index / (safe.length - 1)) * 88;
        const y = 32 - ((value / Math.max(...safe, 1)) * 24);
        return `${x},${Math.max(4, Math.min(28, y))}`;
    }).join(' ');
};

const getStatus = (value, type) => {
    if (value === null || value === undefined || value === '--') {
        return { label: 'Warning', className: 'status-warning', trend: 'Awaiting device feed' };
    }

    if (type === 'bp') {
        const systolic = Number(value?.systolic);
        const diastolic = Number(value?.diastolic);

        if (!systolic || !diastolic) {
            return { label: 'Warning', className: 'status-warning', trend: 'Awaiting device feed' };
        }

        if (systolic >= 180 || diastolic >= 120 || systolic < 90) {
            return { label: 'Critical', className: 'status-critical', trend: 'Blood pressure needs immediate review' };
        }

        if (systolic >= 140 || diastolic >= 90) {
            return { label: 'Warning', className: 'status-warning', trend: 'Blood pressure running high' };
        }

        return { label: 'Normal', className: 'status-normal', trend: 'Blood pressure within a safer range' };
    }

    if (type === 'hr') {
        if (value < 55 || value > 120) return { label: 'Critical', className: 'status-critical', trend: 'Outside resting range' };
        if (value < 60 || value > 100) return { label: 'Warning', className: 'status-warning', trend: 'Slightly elevated' };
        return { label: 'Normal', className: 'status-normal', trend: 'Stable heartbeat' };
    }

    if (type === 'spo2') {
        if (value < 92) return { label: 'Critical', className: 'status-critical', trend: 'Oxygen attention needed' };
        if (value < 95) return { label: 'Warning', className: 'status-warning', trend: 'Monitor saturation' };
        return { label: 'Normal', className: 'status-normal', trend: 'Healthy oxygen level' };
    }

    if (type === 'mood') {
        if (value < 4) return { label: 'Critical', className: 'status-critical', trend: 'Emotional support needed' };
        if (value < 7) return { label: 'Warning', className: 'status-warning', trend: 'Mood trend is softer' };
        return { label: 'Normal', className: 'status-normal', trend: 'Emotion trend positive' };
    }

    if (type === 'completion') {
        if (value < 45) return { label: 'Critical', className: 'status-critical', trend: 'Adherence is low' };
        if (value < 75) return { label: 'Warning', className: 'status-warning', trend: 'Needs follow-up' };
        return { label: 'Normal', className: 'status-normal', trend: 'Adherence on track' };
    }

    if (type === 'alerts') {
        if (value > 4) return { label: 'Critical', className: 'status-critical', trend: 'Multiple care flags' };
        if (value > 0) return { label: 'Warning', className: 'status-warning', trend: 'Guardian attention needed' };
        return { label: 'Normal', className: 'status-normal', trend: 'No open critical events' };
    }

    return { label: 'Normal', className: 'status-normal', trend: 'Within expected range' };
};

const VitalTile = ({ icon, label, value, unit, status, trend, points, className = 'span-4' }) => (
    <article className={`vital-card ${className}`}>
        <div className="metric-header">
            <div className="metric-icon">{icon}</div>
            <span className={`status-badge ${status.className}`}>
                <span className="status-dot" />
                {status.label}
            </span>
        </div>
        <div>
            <p className="metric-label">{label}</p>
            <div className="metric-body">
                <span className="vital-value">{value}</span>
                <span className="metric-unit">{unit}</span>
            </div>
        </div>
        <div className="metric-footer mt-5">
            <span className="metric-trend">{trend}</span>
            <svg viewBox="0 0 88 32" className="metric-sparkline" aria-hidden="true">
                <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} className="text-[var(--accent-teal)]" />
            </svg>
        </div>
    </article>
);

const ElderSummaryCard = ({ elder, todayData, liveVitals }) => {
    if (!elder) return null;

    const moodScore = todayData?.moodScore ?? null;
    const completionRate = Math.max(0, Math.min(100, Number(todayData?.stats?.completionRate ?? 0)));
    const alertCount = todayData?.anomalies?.length || 0;
    const conditions = elder.profile?.diseases?.length || 0;
    const adherenceTarget = 80;
    const heartRateStatus = getStatus(liveVitals.hr, 'hr');
    const spo2Status = getStatus(liveVitals.spo2, 'spo2');
    const bpValue = liveVitals.bp?.systolic && liveVitals.bp?.diastolic
        ? `${liveVitals.bp.systolic}/${liveVitals.bp.diastolic}`
        : '--/--';
    const bpStatus = getStatus(liveVitals.bp, 'bp');
    const moodStatus = getStatus(moodScore, 'mood');
    const completionStatus = getStatus(completionRate, 'completion');
    const alertStatus = getStatus(alertCount, 'alerts');

    return (
        <section className="summary-shell">
            <div className="summary-hero mb-4">
                <div className="summary-hero-meta">
                    <div className="summary-avatar">{elder.name?.[0]}</div>
                    <div>
                        <p className="eyebrow">Linked Patient</p>
                        <h1 className="section-title mt-1">{elder.name}</h1>
                        <p className="section-subtitle mt-1">Age {elder.age} • {elder.gender || 'Profile active'} • {elder.profile?.diseases?.join(', ') || 'General monitoring'}</p>
                    </div>
                </div>
                <div className="stats-row w-full max-w-[420px]">
                    <div className="stat-block">
                        <p className="metric-label">Room</p>
                        <p className="metric-inline-value mt-2">A-12</p>
                    </div>
                    <div className="stat-block">
                        <p className="metric-label">Adherence</p>
                        <p className="metric-inline-value mt-2">{completionRate}%</p>
                        <p className={`text-xs mt-2 ${completionRate >= adherenceTarget ? 'text-[var(--accent-success)]' : 'text-[var(--accent-amber)]'}`}>
                            {completionRate >= adherenceTarget ? 'Above target' : `Below ${adherenceTarget}% target`}
                        </p>
                    </div>
                    <div className="stat-block">
                        <p className="metric-label">Mood</p>
                        <p className="metric-inline-value mt-2">{moodScore ?? '--'}</p>
                    </div>
                    <div className="stat-block">
                        <p className="metric-label">Alerts</p>
                        <p className="metric-inline-value mt-2">{alertCount}</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                <VitalTile
                    icon={<HeartIcon />}
                    label="Heart Rate"
                    value={liveVitals.hr ?? '--'}
                    unit="bpm"
                    status={heartRateStatus}
                    trend={heartRateStatus.trend}
                    points={sparkline([72, 74, 70, liveVitals.hr || 76, 73, 75])}
                    className="span-4"
                />
                <VitalTile
                    icon={<OxygenIcon />}
                    label="SpO2"
                    value={liveVitals.spo2 ?? '--'}
                    unit="%"
                    status={spo2Status}
                    trend={spo2Status.trend}
                    points={sparkline([96, 97, 96, liveVitals.spo2 || 97, 98, 97])}
                    className="span-4"
                />
                <VitalTile
                    icon={<PressureIcon />}
                    label="Blood Pressure"
                    value={bpValue}
                    unit="mmHg"
                    status={bpStatus}
                    trend={bpStatus.trend}
                    points={sparkline([110, 112, 109, liveVitals.bp?.systolic || 113, 111, 112])}
                    className="span-4"
                />
                <VitalTile
                    icon={<ClipboardIcon />}
                    label="Task Completion"
                    value={completionRate}
                    unit="%"
                    status={completionStatus}
                    trend={`${completionStatus.trend} · target ${adherenceTarget}%`}
                    points={sparkline([30, 42, 50, 68, completionRate || 72, 74])}
                    className="span-3"
                />
                <VitalTile
                    icon={<MoodIcon />}
                    label="Mood Score"
                    value={moodScore ?? '--'}
                    unit="/10"
                    status={moodStatus}
                    trend={moodStatus.trend}
                    points={sparkline([5, 6, 6, 7, moodScore || 6, 7])}
                    className="span-3"
                />
                <VitalTile
                    icon={<AlertIcon />}
                    label="Open Alerts"
                    value={alertCount}
                    unit="active"
                    status={alertStatus}
                    trend={alertStatus.trend}
                    points={sparkline([1, 2, 1, 2, alertCount || 1, 1])}
                    className="span-3"
                />
                <VitalTile
                    icon={<BaselineIcon />}
                    label="Care Conditions"
                    value={conditions}
                    unit="tracked"
                    status={{ label: 'Normal', className: 'status-normal' }}
                    trend={`Baseline HR ${elder?.baseline?.restingHR || '--'} bpm • SpO2 ${elder?.baseline?.avgSpO2 || '--'}%`}
                    points={sparkline([2, 2, 3, 3, conditions || 2, conditions || 2])}
                    className="span-3"
                />
            </div>
        </section>
    );
};

export default ElderSummaryCard;

