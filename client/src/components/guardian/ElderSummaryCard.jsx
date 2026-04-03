// FILE: client/src/components/guardian/ElderSummaryCard.jsx

const Ico = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d={d} />
  </svg>
);

const HeartIcon    = () => <Ico d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.57z" />;
const OxygenIcon   = () => <Ico d="M12 2v10M8 6a4 4 0 0 0 8 0M6 18a3 3 0 1 0 6 0c0-1.9-1.2-3.2-3-5-1.8 1.8-3 3.1-3 5z" />;
const PressureIcon = () => <Ico d="M12 3v6M9 6h6M7 21h10M8 9h8l1 4.5A5.5 5.5 0 0 1 11.6 20H12a5.5 5.5 0 0 1-5.4-6.5L8 9z" />;
const TaskIcon     = () => <Ico d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />;
const MoodIcon     = () => <Ico d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 10h.01M16 10h.01M8 15c1.2 1 2.4 1.5 4 1.5s2.8-.5 4-1.5" />;
const AlertIcon    = () => <Ico d="M12 9v4M12 17h.01M10.3 3.3 1.82 18a2 2 0 0 0 1.74 3h16.88a2 2 0 0 0 1.74-3L13.7 3.3a2 2 0 0 0-3.4 0z" />;
const ActivityIcon = () => <Ico d="M4 12h4l2-5 4 10 2-5h4" />;

const getStatus = (value, type) => {
  if (value === null || value === undefined || value === '--') {
    return { label: 'Pending', cls: 'status-warning', trend: 'Awaiting device' };
  }
  if (type === 'bp') {
    const s = Number(value?.systolic), d = Number(value?.diastolic);
    if (!s || !d) return { label: 'Pending', cls: 'status-warning', trend: 'Awaiting device' };
    if (s >= 180 || d >= 120 || s < 90) return { label: 'Critical', cls: 'status-critical', trend: 'Needs immediate review' };
    if (s >= 140 || d >= 90)            return { label: 'Watch',    cls: 'status-warning',  trend: 'Running high' };
    return { label: 'Normal', cls: 'status-normal', trend: 'Within safe range' };
  }
  if (type === 'hr') {
    if (value < 55 || value > 120) return { label: 'Critical', cls: 'status-critical', trend: 'Outside resting range' };
    if (value < 60 || value > 100) return { label: 'Watch',    cls: 'status-warning',  trend: 'Slightly elevated' };
    return { label: 'Normal', cls: 'status-normal', trend: 'Stable heartbeat' };
  }
  if (type === 'spo2') {
    if (value < 92) return { label: 'Critical', cls: 'status-critical', trend: 'Oxygen attention needed' };
    if (value < 95) return { label: 'Watch',    cls: 'status-warning',  trend: 'Monitor saturation' };
    return { label: 'Normal', cls: 'status-normal', trend: 'Healthy oxygen level' };
  }
  if (type === 'completion') {
    if (value < 45) return { label: 'Critical', cls: 'status-critical', trend: 'Adherence is low' };
    if (value < 75) return { label: 'Watch',    cls: 'status-warning',  trend: 'Needs follow-up' };
    return { label: 'Normal', cls: 'status-normal', trend: 'Adherence on track' };
  }
  if (type === 'mood') {
    if (value < 4) return { label: 'Critical', cls: 'status-critical', trend: 'Emotional support needed' };
    if (value < 7) return { label: 'Watch',    cls: 'status-warning',  trend: 'Mood trend softer' };
    return { label: 'Normal', cls: 'status-normal', trend: 'Emotion trend positive' };
  }
  if (type === 'alerts') {
    if (value > 4) return { label: 'Critical', cls: 'status-critical', trend: 'Multiple care flags' };
    if (value > 0) return { label: 'Watch',    cls: 'status-warning',  trend: 'Guardian attention needed' };
    return { label: 'Normal', cls: 'status-normal', trend: 'No open critical events' };
  }
  return { label: 'Normal', cls: 'status-normal', trend: 'Within expected range' };
};

const VitalMini = ({ icon, label, value, unit, status }) => (
  <div className="vital-mini">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--teal-light)', color: 'var(--teal-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span className={`status-badge ${status.cls}`} style={{ fontSize: '0.65rem', padding: '3px 7px' }}>
        <span className="status-dot" style={{ width: 5, height: 5 }} />
        {status.label}
      </span>
    </div>
    <p className="metric-label" style={{ marginBottom: 4 }}>{label}</p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--teal-deep)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unit}</span>
    </div>
    <p style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginTop: 4 }}>{status.trend}</p>
  </div>
);

const ElderSummaryCard = ({ elder, todayData, liveVitals }) => {
  if (!elder) return null;

  const moodScore      = todayData?.moodScore ?? null;
  const completionRate = Math.max(0, Math.min(100, Number(todayData?.stats?.completionRate ?? 0)));
  const alertCount     = todayData?.anomalies?.length || 0;
  const bpValue        = liveVitals.bp?.systolic && liveVitals.bp?.diastolic
    ? `${liveVitals.bp.systolic}/${liveVitals.bp.diastolic}` : '--/--';

  const hrStatus   = getStatus(liveVitals.hr, 'hr');
  const spo2Status = getStatus(liveVitals.spo2, 'spo2');
  const bpStatus   = getStatus(liveVitals.bp, 'bp');
  const compStatus = getStatus(completionRate, 'completion');
  const moodStatus = getStatus(moodScore, 'mood');
  const alertStatus= getStatus(alertCount, 'alerts');

  return (
    <section style={{ marginBottom: 16 }}>
      {/* Patient hero */}
      <div className="elder-summary-card">
        <div className="elder-summary-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="summary-avatar">{elder.name?.[0]}</div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 4 }}>Linked Patient</p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                {elder.name}
              </h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
                Age {elder.age} · {elder.profile?.diseases?.join(', ') || 'General monitoring'}
              </p>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <span className={`status-badge ${alertCount > 0 ? 'status-warning' : 'status-normal'}`}>
                <span className="status-dot" />
                {alertCount > 0 ? `${alertCount} alerts` : 'All clear'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal-deep)' }}>Today's Adherence</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{completionRate}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>

        {/* Stat summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '16px 20px' }}>
          {[
            { label: 'Tasks Done', value: todayData?.stats?.done ?? '--' },
            { label: 'Adherence',  value: `${completionRate}%` },
            { label: 'Mood',       value: moodScore ?? '--' },
            { label: 'Open Alerts',value: alertCount },
          ].map((s) => (
            <div key={s.label} className="stat-block" style={{ textAlign: 'center' }}>
              <p className="metric-label">{s.label}</p>
              <p className="metric-inline-value" style={{ marginTop: 6, fontSize: '1.1rem' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Vitals strip */}
        <div className="elder-vitals-strip">
          <VitalMini icon={<HeartIcon />}    label="Heart Rate" value={liveVitals.hr ?? '--'}    unit="bpm"   status={hrStatus} />
          <VitalMini icon={<OxygenIcon />}   label="SpO₂"       value={liveVitals.spo2 ?? '--'} unit="%"     status={spo2Status} />
          <VitalMini icon={<PressureIcon />} label="Blood Pressure" value={bpValue}              unit="mmHg"  status={bpStatus} />
          <VitalMini icon={<TaskIcon />}     label="Completion" value={completionRate}            unit="%"     status={compStatus} />
          <VitalMini icon={<MoodIcon />}     label="Mood Score" value={moodScore ?? '--'}         unit="/10"   status={moodStatus} />
          <VitalMini icon={<ActivityIcon />} label="Alerts"     value={alertCount}               unit="open"  status={alertStatus} />
        </div>
      </div>
    </section>
  );
};

export default ElderSummaryCard;
