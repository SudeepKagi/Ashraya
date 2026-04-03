// FILE: client/src/components/guardian/AlertFeed.jsx

const ALERT_META = {
  fall_detected:   { label: 'Fall Detected',         emoji: '⚠️', cls: 'alert-critical' },
  sos_triggered:   { label: 'SOS Triggered',          emoji: '🆘', cls: 'alert-critical' },
  medicine_supply: { label: 'Medicine Running Low',   emoji: '💊', cls: 'alert-warning' },
  health_anomaly:  { label: 'Health Anomaly',         emoji: '📊', cls: 'alert-warning' },
  emotion_alert:   { label: 'Emotional Concern',      emoji: '💙', cls: 'alert-warning' },
  task_completed:  { label: 'Task Completed',         emoji: '✅', cls: 'alert-info' },
  watch_live:      { label: 'Live Watch Update',      emoji: '⌚', cls: 'alert-info' },
};

const AlertFeed = ({ alerts, onMarkRead }) => {
  const fmt = (v) => new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (!alerts.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ fontSize: '2rem', marginBottom: 8 }}>✨</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No alerts at the moment</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-label)', marginTop: 4 }}>Everything looks calm and clear.</p>
      </div>
    );
  }

  return (
    <div className="alerts-list">
      {alerts.map((alert, i) => {
        const meta = ALERT_META[alert.type] || { label: 'Alert', emoji: 'ℹ️', cls: 'alert-info' };
        const msg  = alert.anomalyReason || alert.reason || alert.concern || 'Care team update available.';
        return (
          <article key={alert._id || i} className={`alert-item ${meta.cls}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }}>{meta.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>{meta.label}</p>
                  {!alert.isRead && !String(alert._id || '').startsWith('live_') && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                      background: 'var(--teal-deep)', color: 'white',
                    }}>NEW</span>
                  )}
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-body)', lineHeight: 1.55 }}>{msg}</p>
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-label)', whiteSpace: 'nowrap' }}>
                {fmt(alert.timestamp)}
              </p>
              {!alert.isRead && alert._id && !String(alert._id).startsWith('live_') ? (
                <button
                  onClick={() => onMarkRead?.(alert._id)}
                  style={{
                    marginTop: 8, fontSize: '0.75rem', fontWeight: 600,
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    background: 'var(--teal-deep)', color: 'white',
                    border: 0, cursor: 'pointer',
                  }}
                  aria-label="Mark alert as read"
                >
                  Mark read
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-label)', marginTop: 8, display: 'block' }}>
                  {alert.isRead ? 'Read' : 'Live'}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default AlertFeed;
