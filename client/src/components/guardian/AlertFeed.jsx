// FILE: client/src/components/guardian/AlertFeed.jsx
const ALERT_ICONS = {
    fall_detected: 'FALL',
    sos_triggered: 'SOS',
    medicine_supply: 'MED',
    health_anomaly: 'WARN',
    emotion_alert: 'MOOD',
    task_completed: 'DONE',
    watch_live: 'LIVE'
};

const ALERT_TITLE = {
    fall_detected: 'Fall Detected',
    sos_triggered: 'SOS Triggered',
    medicine_supply: 'Medicine Running Low',
    health_anomaly: 'Health Anomaly',
    emotion_alert: 'Emotional Concern',
    task_completed: 'Task Completed',
    watch_live: 'Live Watch Feed'
};

const getSeverityClass = (alert) => {
    if (alert.type === 'fall_detected' || alert.type === 'sos_triggered') return 'severity-critical';
    if (alert.type === 'medicine_supply' || alert.type === 'health_anomaly' || alert.type === 'emotion_alert') return 'severity-warning';
    return 'severity-normal';
};

const AlertFeed = ({ alerts, onMarkRead }) => {
    const formatTime = (value) => new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (!alerts.length) {
        return (
            <div className="text-center py-12 muted-text">
                <p className="text-4xl mb-2">•</p>
                <p className="text-sm">No alerts in the selected window</p>
            </div>
        );
    }

    return (
        <div className="alerts-list">
            {alerts.map((alert, index) => {
                const severityClass = getSeverityClass(alert);
                const message = alert.anomalyReason || alert.reason || alert.concern || 'Care team update available.';
                return (
                    <article key={alert._id || index} className="alert-item">
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="metric-icon text-xs font-bold">{ALERT_ICONS[alert.type] || 'INFO'}</div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <p className="text-sm font-semibold text-white">{ALERT_TITLE[alert.type] || 'Alert'}</p>
                                    <span className={`severity-tag ${severityClass}`}>{severityClass.replace('severity-', '')}</span>
                                </div>
                                <p className="text-sm muted-text mt-2 leading-6">{message}</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs text-label whitespace-nowrap">{formatTime(alert.timestamp)}</p>
                            {!alert.isRead && alert._id && !String(alert._id).startsWith('live_') ? (
                                <button
                                    onClick={() => onMarkRead?.(alert._id)}
                                    className="range-pill active mt-3"
                                    aria-label="Mark alert as read"
                                >
                                    Mark read
                                </button>
                            ) : (
                                <span className="text-xs muted-text mt-3 inline-block">{alert.isRead ? 'Read' : 'Live'}</span>
                            )}
                        </div>
                    </article>
                );
            })}
        </div>
    );
};

export default AlertFeed;

