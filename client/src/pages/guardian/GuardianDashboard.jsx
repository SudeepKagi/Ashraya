// FILE: client/src/pages/guardian/GuardianDashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socketService';
import { generateReport, getReportHistory, getTodayReport, openReportPdf } from '../../services/reportService';
import ElderSummaryCard from '../../components/guardian/ElderSummaryCard';
import AlertFeed from '../../components/guardian/AlertFeed';
import ReportViewer from '../../components/guardian/ReportViewer';
import { useAccessibility } from '../../context/AccessibilityContext';

/* ── Icons ── */
const Svg = ({ children, size = 20 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    {children}
  </svg>
);
const TodayIcon    = () => <Svg><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Svg>;
const AlertIcon    = () => <Svg><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.5 21a1.5 1.5 0 0 0 3 0" /></Svg>;
const HistoryIcon  = () => <Svg><path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M14 14h7v7h-7z" /><path d="M3 14h7v7H3z" /></Svg>;
const ReportIcon   = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></Svg>;
const BellIcon     = () => <Svg><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.5 21a1.5 1.5 0 0 0 3 0" /></Svg>;
const SparkIcon    = () => <Svg><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" /></Svg>;
const PhoneIcon    = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>;
const LogoutIcon   = () => <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Svg>;

const buildPoints = (items, key, maxValue) => {
  if (!items.length) return '';
  return items.map((item, i) => {
    const x = items.length === 1 ? 320 : (i / (items.length - 1)) * 640;
    const y = 200 - (Number(item[key] ?? 0) / maxValue) * 180;
    return `${x},${Math.max(10, Math.min(190, y))}`;
  }).join(' ');
};

/* ── Alert type colours ── */
const alertColor = (type) => {
  if (type === 'fall_detected' || type === 'sos_triggered') return { bg: '#ffdad5', border: '#bd3729', dot: '#bd3729', text: '#9b1e14' };
  if (type === 'health_anomaly') return { bg: '#ffddb8', border: '#ffad3e', dot: '#865300', text: '#865300' };
  return { bg: 'var(--bg-warm)', border: 'var(--border)', dot: 'var(--text-muted)', text: 'var(--text-body)' };
};
const alertTitle = (type) => ({
  fall_detected: 'Fall Detected',
  sos_triggered: 'SOS Triggered',
  health_anomaly: 'Health Anomaly',
  emotion_alert: 'Emotion Alert',
  medicine_supply: 'Missed Medicine',
}[type] || 'Alert');

/* ── MAIN ── */
const GuardianDashboard = () => {
  const { logout } = useAuth();
  const { settings } = useAccessibility();

  const [elder, setElder]               = useState(null);
  const [todayData, setTodayData]       = useState(null);
  const [alerts, setAlerts]             = useState([]);
  const [liveVitals, setLiveVitals]     = useState({ hr: null, spo2: null, battery: null });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [activeTab, setActiveTab]       = useState('today');
  const [history, setHistory]           = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [report, setReport]             = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [range, setRange]               = useState('24H');
  const alertsRef = useRef([]);

  const fetchReports = useCallback(async (elderId) => {
    if (!elderId) return;
    setReportLoading(true);
    try {
      const [todayReport, historyReports] = await Promise.all([
        getTodayReport(elderId), getReportHistory(elderId)
      ]);
      setReport(todayReport); setReportHistory(historyReports);
    } catch (err) { console.error('Report fetch:', err.message); }
    finally { setReportLoading(false); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [elderRes, alertsRes] = await Promise.all([
        api.get('/guardian/elder'),
        api.get('/guardian/alerts?days=7&limit=40'),
      ]);
      const elderData = elderRes.data.elder;
      setElder(elderData); setTodayData(elderRes.data.today);
      alertsRef.current = alertsRes.data.alerts || [];
      setAlerts(alertsRef.current); setLastUpdatedAt(Date.now());
      if (elderRes.data.today?.latestHR) setLiveVitals(v => ({ ...v, hr: elderRes.data.today.latestHR }));
      if (elderRes.data.today?.latestSpO2) setLiveVitals(v => ({ ...v, spo2: elderRes.data.today.latestSpO2 }));
      await fetchReports(elderData?._id);
    } catch (err) { setError(err.response?.data?.message || 'Failed to load elder data'); }
    finally { setLoading(false); }
  }, [fetchReports]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/guardian/history');
      setHistory(data.history || []); setLastUpdatedAt(Date.now());
    } catch (err) { console.error('History:', err.message); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (activeTab === 'history' && history.length === 0) fetchHistory();
  }, [activeTab, history.length, fetchHistory]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const addAlert = (type, data) => {
      const a = { _id: `live_${Date.now()}`, type, ...data, timestamp: data.timestamp || new Date(), isAnomaly: true, isRead: false };
      alertsRef.current = [a, ...alertsRef.current.slice(0, 39)];
      setAlerts([...alertsRef.current]); setLastUpdatedAt(Date.now());
    };
    socket.on('fall_detected', d => { addAlert('fall_detected', d); document.title = 'FALL ALERT - Ashraya'; setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000); });
    socket.on('sos_triggered', d => { addAlert('sos_triggered', d); document.title = 'SOS - Ashraya'; setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000); });
    socket.on('health_anomaly', d => addAlert(d.type === 'medicine_supply' ? 'medicine_supply' : 'health_anomaly', d));
    socket.on('emotion_alert', d => addAlert('emotion_alert', d));
    socket.on('task_completed', () => {
      setTodayData(cur => {
        if (!cur?.stats) return cur;
        const done = (cur.stats.done || 0) + 1;
        const pending = Math.max(0, (cur.stats.pending || 1) - 1);
        const total = cur.stats.total || done + pending;
        return { ...cur, stats: { ...cur.stats, done, pending, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 } };
      });
      setLastUpdatedAt(Date.now());
    });
    socket.on('watch_live', d => { setLiveVitals(v => ({ ...v, hr: d.hr ?? v.hr, spo2: d.spo2 ?? v.spo2, battery: d.battery ?? v.battery })); setLastUpdatedAt(Date.now()); });
    return () => ['fall_detected','sos_triggered','health_anomaly','emotion_alert','task_completed','watch_live'].forEach(e => socket.off(e));
  }, []);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const newReport = await generateReport({});
      setReport(newReport); setLastUpdatedAt(Date.now());
      if (elder?._id) setReportHistory(await getReportHistory(elder._id));
    } catch (err) { setError(err.response?.data?.message || 'Failed to generate report'); }
    finally { setGeneratingReport(false); }
  };

  const handleMarkRead = async (alertId) => {
    try {
      await api.put(`/guardian/alerts/${alertId}/read`);
      const next = alerts.map(a => a._id === alertId ? { ...a, isRead: true } : a);
      alertsRef.current = next; setAlerts(next);
    } catch (err) { console.error('Mark read:', err.message); }
  };

  const unreadCount    = alerts.filter(a => !a.isRead).length;
  const drawerOpen     = activeTab === 'reports';
  const completionRate = todayData?.stats?.completionRate || 0;
  const moodScore      = todayData?.moodScore;
  const moodLabel      = moodScore >= 7 ? 'Stable 😊' : moodScore >= 4 ? 'Moderate 😐' : moodScore != null ? 'Low 😔' : 'Stable';
  const historyData    = [...history].reverse();
  const moodPoints     = buildPoints(historyData, 'moodScore', 10);
  const completionPoints = buildPoints(historyData, 'completionRate', 100);
  const updatedAgo     = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  const elderName      = elder?.name || 'Your Elder';
  const elderInitial   = elderName[0]?.toUpperCase() || 'E';

  /* ── Shared styles ── */
  const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: 20, padding: 20,
    boxShadow: 'var(--shadow-card)', marginBottom: 14,
  };
  const shellStyle = {
    minHeight: '100vh', background: 'var(--bg-cream)',
    maxWidth: 520, margin: '0 auto',
    display: 'flex', flexDirection: 'column',
  };

  return (
    <div className={`${settings.largeText ? 'large-text' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}
      style={shellStyle}>

      {/* ── Header: "Guardian Hub" ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 14px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Guardian avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--teal-mid)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
          }}>G</div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)', lineHeight: 1 }}>
              Guardian Hub
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#22c55e',
              animation: 'live-pulse 2s infinite',
              display: 'inline-block',
            }} />
            Live
          </div>
          {/* Notification bell */}
          <button onClick={() => setActiveTab('alerts')} style={{
            background: 'none', border: 0, cursor: 'pointer',
            color: unreadCount ? 'var(--red)' : 'var(--text-muted)',
            position: 'relative', padding: 4,
          }} aria-label="View alerts">
            <BellIcon />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--red-container)', color: 'white',
                fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <button onClick={logout} style={{
            background: 'none', border: 0, cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }} aria-label="Logout">
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* ── Main scrollable content ── */}
      <main style={{ flex: 1, padding: '16px 16px 100px', overflowY: 'auto' }}>
        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 12, borderRadius: 12,
            background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.85rem',
          }}>
            {error}
            <button onClick={fetchData} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--red)', textDecoration: 'underline', marginLeft: 6 }}>Retry</button>
          </div>
        )}

        {/* ═══════════════ TODAY TAB ═══════════════ */}
        {activeTab === 'today' && (
          <>
            {/* Elder profile card */}
            <div style={{ ...cardStyle, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--teal-mid), var(--teal-deep))',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.2rem', flexShrink: 0,
                  }}>{elderInitial}</div>
                  <div>
                    {loading ? (
                      <div style={{ width: 120, height: 14, borderRadius: 8, background: 'var(--bg-muted)', animation: 'pulse-bg 1.5s infinite' }} />
                    ) : (
                      <>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>{elderName}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'live-pulse 2s infinite' }} />
                          <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700 }}>Active Now ▸</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--bg-warm)', border: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--teal-deep)',
                }} aria-label="Call elder">
                  <PhoneIcon />
                </button>
              </div>
            </div>

            {/* Vital pills */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[
                { icon: '❤️', label: 'Heart Rate', value: liveVitals.hr ?? todayData?.latestHR ?? '--', unit: 'bpm', color: '#c0392b' },
                { icon: '🫁', label: 'SpO₂', value: liveVitals.spo2 ?? todayData?.latestSpO2 ?? '--', unit: '%', color: 'var(--teal-deep)' },
                { icon: '🔋', label: 'Battery', value: liveVitals.battery ?? '--', unit: '%', color: '#865300' },
              ].map(v => (
                <div key={v.label} style={{
                  flex: 1, background: 'var(--bg-card)', borderRadius: 16, padding: '14px 8px',
                  textAlign: 'center', boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{v.icon}</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: v.color || 'var(--text-heading)', lineHeight: 1 }}>
                    {v.value}
                  </p>
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>{v.unit}</p>
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>{v.label}</p>
                </div>
              ))}
            </div>

            {/* Last updated */}
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: 14, fontWeight: 600 }}>
              LAST UPDATED {updatedAgo}s AGO
            </p>

            {/* Today's Summary */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>Today's Summary</h2>
                <button onClick={() => setActiveTab('reports')} style={{
                  background: 'none', border: 0, cursor: 'pointer',
                  color: 'var(--teal-mid)', fontSize: '0.78rem', fontWeight: 700,
                }}>View Report</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Daily Tasks donut */}
                <div style={{
                  background: 'var(--bg-warm)', borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ position: 'relative', width: 60, height: 60 }}>
                    <svg viewBox="0 0 60 60" style={{ width: 60, height: 60, transform: 'rotate(-90deg)' }}>
                      <circle cx="30" cy="30" r="24" fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
                      <circle cx="30" cy="30" r="24" fill="none"
                        stroke="var(--teal-mid)" strokeWidth="6"
                        strokeDasharray={`${(completionRate / 100) * 150.8} 150.8`}
                        strokeLinecap="round" />
                    </svg>
                    <span style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-heading)',
                    }}>{completionRate}%</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>Daily Tasks</p>
                </div>
                {/* Mood score */}
                <div style={{
                  background: 'var(--bg-warm)', borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 28 }}>
                    {moodScore >= 7 ? '😊' : moodScore >= 4 ? '😐' : '😔'}
                  </span>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mood Score</p>
                    <p style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: 2 }}>{moodLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>Recent Alerts</h2>
                {unreadCount > 0 && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                    background: 'var(--red-light)', color: 'var(--red)',
                  }}>{unreadCount} CRITICAL</span>
                )}
              </div>
              {alerts.slice(0, 4).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No recent alerts</p>
              ) : (
                alerts.slice(0, 4).map(alert => {
                  const c = alertColor(alert.type);
                  return (
                    <div key={alert._id} style={{
                      borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                      background: c.bg, borderLeft: `3px solid ${c.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: c.text }}>{alertTitle(alert.type)}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                            {alert.message?.slice(0, 80) || 'Alert triggered'}
                          </p>
                          {(alert.type === 'fall_detected' || alert.type === 'sos_triggered') && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button style={{
                                padding: '5px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
                                background: 'var(--red-container)', color: 'white',
                                fontSize: '0.72rem', fontWeight: 700,
                              }}>Urgent Call</button>
                              <button onClick={() => handleMarkRead(alert._id)} style={{
                                padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                                background: 'transparent', border: `1px solid ${c.border}`,
                                fontSize: '0.72rem', fontWeight: 700, color: c.text,
                              }}>Dismiss</button>
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ═══════════════ ALERTS TAB ═══════════════ */}
        {activeTab === 'alerts' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>All Guardian Alerts</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                Real-time safety alerts, medicine warnings, and emotional risk flags.
              </p>
            </div>
            <AlertFeed alerts={alerts} onMarkRead={handleMarkRead} />
          </>
        )}

        {/* ═══════════════ HISTORY TAB ═══════════════ */}
        {activeTab === 'history' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>Vitals & Adherence Trends</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {['1H','6H','24H','7D'].map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    padding: '4px 10px', borderRadius: 999, border: 0, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                    background: range === r ? 'var(--teal-mid)' : 'var(--bg-muted)',
                    color: range === r ? 'white' : 'var(--text-muted)',
                  }}>{r}</button>
                ))}
              </div>
            </div>
            <div style={cardStyle}>
              {historyLoading ? (
                <div style={{ height: 200, borderRadius: 12, background: 'var(--bg-muted)', animation: 'pulse-bg 1.5s infinite' }} />
              ) : historyData.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No history available yet.</p>
              ) : (
                <>
                  <svg viewBox="0 0 680 220" style={{ width: '100%', height: 220 }}>
                    {[20,60,100,140,180].map(l => <line key={l} x1="0" x2="680" y1={l} y2={l} stroke="var(--border)" strokeWidth="0.5" />)}
                    <polyline points={completionPoints} fill="none" stroke="var(--teal-deep)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={moodPoints} fill="none" stroke="var(--amber-container)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ width: 12, height: 4, borderRadius: 2, background: 'var(--teal-deep)', display: 'inline-block' }} />
                      Task Completion
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ width: 12, height: 4, borderRadius: 2, background: 'var(--amber-container)', display: 'inline-block' }} />
                      Mood Score
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyData.map(day => (
                <div key={day.date} style={{
                  background: 'var(--bg-card)', borderRadius: 14, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {day.totalTasks || 0} tasks · {day.doneTasks || 0} completed
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--teal-deep)' }}>{day.completionRate ?? '--'}%</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Mood {day.moodScore ?? '--'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════════ REPORT TAB ═══════════════ */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>AI Daily Report</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                AI-generated health and adherence reports.
              </p>
            </div>
            <ReportViewer
              report={report}
              reportHistory={reportHistory}
              loading={reportLoading}
              generating={generatingReport}
              onGenerate={handleGenerateReport}
              onOpen={openReportPdf}
              open={true}
              onClose={() => setActiveTab('today')}
            />
          </div>
        )}
      </main>

      {/* ── Bottom Navigation (Stitch: Today / Alerts / History / Report) ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 520,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        padding: '8px 8px 12px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        zIndex: 30,
      }} aria-label="Guardian navigation">
        {[
          { key: 'today',   label: 'Today',   icon: <TodayIcon /> },
          { key: 'alerts',  label: 'Alerts',  icon: <AlertIcon />, badge: unreadCount },
          { key: 'history', label: 'History', icon: <HistoryIcon /> },
          { key: 'reports', label: 'Report',  icon: <ReportIcon /> },
        ].map(item => (
          <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
            flex: 1, background: 'none', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === item.key ? 'var(--teal-deep)' : 'var(--text-muted)',
            fontSize: '0.7rem', fontWeight: activeTab === item.key ? 800 : 500,
            position: 'relative', padding: '4px 4px',
            transition: 'color 0.2s',
          }} aria-label={item.label} aria-current={activeTab === item.key ? 'page' : undefined}>
            {item.icon}
            {item.label}
            {item.badge > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: '20%',
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--red-container)', color: 'white',
                fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{item.badge > 9 ? '9+' : item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── AI Report Drawer (desktop / larger screens) ── */}
      {activeTab !== 'reports' && (
        <ReportViewer
          report={report}
          reportHistory={reportHistory}
          loading={reportLoading}
          generating={generatingReport}
          onGenerate={handleGenerateReport}
          onOpen={openReportPdf}
          open={false}
          onClose={() => {}}
        />
      )}
    </div>
  );
};

export default GuardianDashboard;
