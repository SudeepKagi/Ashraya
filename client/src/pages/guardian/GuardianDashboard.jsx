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

const IconBase = ({ children }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        {children}
    </svg>
);

const LayoutDashboardIcon = () => <IconBase><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="4" rx="1.5" /><rect x="14" y="10" width="7" height="11" rx="1.5" /><rect x="3" y="13" width="7" height="8" rx="1.5" /></IconBase>;
const ActivityIcon = () => <IconBase><path d="M4 13h4l2-5 4 10 2-5h4" /></IconBase>;
const UsersIcon = () => <IconBase><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></IconBase>;
const BellIcon = () => <IconBase><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.5 21a1.5 1.5 0 0 0 3 0" /></IconBase>;
const SettingsIcon = () => <IconBase><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></IconBase>;
const SparkIcon = () => <IconBase><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" /></IconBase>;

const buildPoints = (items, key, maxValue) => {
    if (!items.length) return '';

    return items.map((item, index) => {
        const x = items.length === 1 ? 320 : (index / (items.length - 1)) * 640;
        const safeValue = Number(item[key] ?? 0);
        const y = 200 - (safeValue / maxValue) * 180;
        return `${x},${Math.max(10, Math.min(190, y))}`;
    }).join(' ');
};

const GuardianDashboard = () => {
    const { logout } = useAuth();
    const { settings } = useAccessibility();
    const [elder, setElder] = useState(null);
    const [todayData, setTodayData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [liveVitals, setLiveVitals] = useState({ hr: null, spo2: null, bp: null, battery: null, source: 'idle' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('today');
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [reportHistory, setReportHistory] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
    const [range, setRange] = useState('24H');

    const alertsRef = useRef([]);

    const fetchReports = useCallback(async (elderId) => {
        if (!elderId) return;

        setReportLoading(true);
        try {
            const [todayReport, historyReports] = await Promise.all([
                getTodayReport(elderId),
                getReportHistory(elderId)
            ]);
            setReport(todayReport);
            setReportHistory(historyReports);
        } catch (err) {
            console.error('Report fetch failed:', err.message);
        } finally {
            setReportLoading(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [elderRes, alertsRes] = await Promise.all([
                api.get('/guardian/elder'),
                api.get('/guardian/alerts?days=7&limit=40')
            ]);

            const elderData = elderRes.data.elder;
            setElder(elderData);
            setTodayData(elderRes.data.today);
            alertsRef.current = alertsRes.data.alerts || [];
            setAlerts(alertsRef.current);
            setLastUpdatedAt(Date.now());

            if (elderRes.data.today?.latestHR) {
                setLiveVitals((value) => ({ ...value, hr: elderRes.data.today.latestHR }));
            }
            if (elderRes.data.today?.latestSpO2) {
                setLiveVitals((value) => ({ ...value, spo2: elderRes.data.today.latestSpO2 }));
            }
            if (elderRes.data.today?.latestBP) {
                setLiveVitals((value) => ({ ...value, bp: elderRes.data.today.latestBP }));
            }

            await fetchReports(elderData?._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load elder data');
        } finally {
            setLoading(false);
        }
    }, [fetchReports]);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const { data } = await api.get('/guardian/history');
            setHistory(data.history || []);
            setLastUpdatedAt(Date.now());
        } catch (err) {
            console.error('History fetch failed:', err.message);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (activeTab === 'history' && history.length === 0) {
            fetchHistory();
        }
    }, [activeTab, history.length, fetchHistory]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const addAlert = (type, data) => {
            const newAlert = {
                _id: `live_${Date.now()}`,
                type,
                ...data,
                timestamp: data.timestamp || new Date(),
                isAnomaly: true,
                isRead: false
            };
            alertsRef.current = [newAlert, ...alertsRef.current.slice(0, 39)];
            setAlerts([...alertsRef.current]);
            setLastUpdatedAt(Date.now());
        };

        socket.on('fall_detected', (data) => {
            addAlert('fall_detected', data);
            document.title = 'FALL ALERT - Ashraya';
            setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000);
        });

        socket.on('sos_triggered', (data) => {
            addAlert('sos_triggered', data);
            document.title = 'SOS - Ashraya';
            setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000);
        });

        socket.on('health_anomaly', (data) => {
            addAlert(data.type === 'medicine_supply' ? 'medicine_supply' : 'health_anomaly', data);
        });

        socket.on('emotion_alert', (data) => {
            addAlert('emotion_alert', data);
        });

        socket.on('task_completed', () => {
            setTodayData((current) => {
                if (!current?.stats) return current;
                const done = (current.stats.done || 0) + 1;
                const pending = Math.max(0, (current.stats.pending || 1) - 1);
                const total = current.stats.total || done + pending + (current.stats.skipped || 0) + (current.stats.refused || 0);
                const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

                return {
                    ...current,
                    stats: {
                        ...current.stats,
                        done,
                        pending,
                        completionRate
                    }
                };
            });
            setLastUpdatedAt(Date.now());
        });

        socket.on('watch_live', (data) => {
            setLiveVitals((value) => ({
                ...value,
                hr: data.hr ?? value.hr,
                spo2: data.spo2 ?? value.spo2,
                bp: data.bp ?? value.bp,
                battery: data.battery ?? value.battery,
                source: data.source ?? value.source
            }));
            setLastUpdatedAt(Date.now());
        });

        return () => {
            ['fall_detected', 'sos_triggered', 'health_anomaly', 'emotion_alert', 'task_completed', 'watch_live']
                .forEach((eventName) => socket.off(eventName));
        };
    }, []);

    const handleGenerateReport = async () => {
        setGeneratingReport(true);
        try {
            const newReport = await generateReport({});
            setReport(newReport);
            setLastUpdatedAt(Date.now());
            if (elder?._id) {
                const historyReports = await getReportHistory(elder._id);
                setReportHistory(historyReports);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate report');
        } finally {
            setGeneratingReport(false);
        }
    };

    const handleMarkRead = async (alertId) => {
        try {
            await api.put(`/guardian/alerts/${alertId}/read`);
            const nextAlerts = alerts.map((alert) => (
                alert._id === alertId ? { ...alert, isRead: true } : alert
            ));
            alertsRef.current = nextAlerts;
            setAlerts(nextAlerts);
        } catch (err) {
            console.error('Mark read failed:', err.message);
        }
    };

    const unreadCount = alerts.filter((alert) => !alert.isRead).length;
    const drawerOpen = activeTab === 'reports';
    const surfaceTab = activeTab === 'reports' ? 'today' : activeTab;
    const updatedSeconds = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
    const historyData = [...history].reverse();
    const moodPoints = buildPoints(historyData, 'moodScore', 10);
    const completionPoints = buildPoints(historyData, 'completionRate', 100);
    const previewAlerts = alerts.slice(0, 4);

    const navItems = [
        { key: 'today', label: 'Overview', icon: <LayoutDashboardIcon /> },
        { key: 'reports', label: 'AI Insights', icon: <ActivityIcon /> },
        { key: 'history', label: 'History', icon: <UsersIcon /> },
        { key: 'alerts', label: 'Alerts', icon: <BellIcon /> }
    ];

    return (
        <div className={`dashboard-shell ${settings.simplifiedUI ? 'text-base' : ''}`}>
            <aside className="dashboard-sidebar">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-mark">A</div>
                    <div className="sidebar-label">
                        <p className="text-sm font-semibold text-white">Ashraya</p>
                        <p className="text-xs text-slate-400">Guardian Monitor</p>
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label="Guardian navigation">
                    {navItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setActiveTab(item.key)}
                            className={`sidebar-item ${activeTab === item.key ? 'active' : ''}`}
                            aria-label={item.label}
                        >
                            {item.icon}
                            <span className="sidebar-label text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                    <button
                        onClick={logout}
                        className="sidebar-item"
                        aria-label="Logout"
                    >
                        <SettingsIcon />
                        <span className="sidebar-label text-sm font-medium">Logout</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{elder?.name?.[0] || 'G'}</div>
                        <div className="sidebar-label">
                            <p className="text-sm font-semibold text-white">Guardian</p>
                            <p className="text-xs text-slate-400">Care account</p>
                        </div>
                    </div>
                </div>
            </aside>

            <header className="dashboard-topbar">
                <div className="topbar-patient">
                    <span className="topbar-title">{elder?.name || 'Patient Overview'}</span>
                    <span className="topbar-subtitle">Home Monitoring Ward • Linked Guardian View</span>
                </div>

                <div className="live-indicator">
                    <span className="live-dot" />
                    <span>Live · Updated {updatedSeconds}s ago</span>
                </div>

                <div className="topbar-actions">
                    <button
                        onClick={() => setActiveTab(drawerOpen ? 'today' : 'reports')}
                        className="header-pill-button"
                        aria-label="Open AI insights"
                    >
                        <SparkIcon />
                        <span className="ml-2">AI Insights</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className="header-icon-button relative"
                        aria-label="Open notifications"
                    >
                        <BellIcon />
                        {unreadCount ? <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-[var(--accent-coral)] text-[10px] text-white inline-flex items-center justify-center px-1">{unreadCount}</span> : null}
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                {error ? (
                    <div className="glass-panel p-4 mb-4 text-sm critical-text">
                        {error}
                        <button onClick={fetchData} className="ml-3 underline text-white">Retry</button>
                    </div>
                ) : null}

                {surfaceTab === 'today' ? (
                    <div className="space-y-4">
                        <ElderSummaryCard elder={elder} todayData={todayData} liveVitals={liveVitals} />
                        <section className="alerts-shell">
                            <div className="alerts-header">
                                <div>
                                    <p className="eyebrow">Incoming Signals</p>
                                    <h2 className="section-title">Recent Alerts</h2>
                                    <p className="section-subtitle">Guardian-visible warnings, emotional flags, and care events.</p>
                                </div>
                                <button onClick={() => setActiveTab('alerts')} className="range-pill active" aria-label="View all alerts">View All</button>
                            </div>
                            <AlertFeed alerts={previewAlerts} onMarkRead={handleMarkRead} />
                        </section>
                    </div>
                ) : null}

                {surfaceTab === 'alerts' ? (
                    <section className="alerts-shell">
                        <div className="alerts-header">
                            <div>
                                <p className="eyebrow">Alert Center</p>
                                <h2 className="section-title">All Guardian Alerts</h2>
                                <p className="section-subtitle">Critical events, medicine warnings, and emotional risk flags in one stream.</p>
                            </div>
                            <div className="chart-tooltip">
                                <span className="live-dot" />
                                <span>{unreadCount} unread</span>
                            </div>
                        </div>
                        <AlertFeed alerts={alerts} onMarkRead={handleMarkRead} />
                    </section>
                ) : null}

                {surfaceTab === 'history' ? (
                    <section className="history-shell">
                        <div className="history-header">
                            <div>
                                <p className="eyebrow">Trend Analysis</p>
                                <h2 className="section-title">Vitals and Adherence Trends</h2>
                                <p className="section-subtitle">Track mood, completion, and daily consistency over time.</p>
                            </div>
                            <div className="range-tabs">
                                {['1H', '6H', '24H', '7D'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setRange(item)}
                                        className={`range-pill ${range === item ? 'active' : ''}`}
                                        aria-label={`Select ${item} range`}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="chart-surface">
                            {historyLoading ? (
                                <div className="h-[240px] rounded-[20px] bg-white/5 animate-pulse" />
                            ) : historyData.length === 0 ? (
                                <div className="h-[240px] flex items-center justify-center text-sm muted-text">No history available yet.</div>
                            ) : (
                                <>
                                    <svg viewBox="0 0 680 220" className="w-full h-[260px]" aria-label="History trend chart">
                                        {[20, 60, 100, 140, 180].map((line) => (
                                            <line key={line} x1="0" x2="680" y1={line} y2={line} className="chart-grid-line" />
                                        ))}
                                        <polyline className="chart-line-primary" points={completionPoints} />
                                        <polyline className="chart-line-secondary" points={moodPoints} />
                                        {historyData.map((entry, index) => {
                                            const x = historyData.length === 1 ? 320 : (index / (historyData.length - 1)) * 640;
                                            const moodY = 200 - ((Number(entry.moodScore || 0) / 10) * 180);
                                            const completionY = 200 - ((Number(entry.completionRate || 0) / 100) * 180);
                                            return (
                                                <g key={entry.date}>
                                                    <circle cx={x} cy={Math.max(10, Math.min(190, completionY))} r="4" className="chart-dot-primary">
                                                        <title>{`${new Date(entry.date).toLocaleDateString('en-IN')}: ${entry.completionRate || 0}% completion`}</title>
                                                    </circle>
                                                    <circle cx={x} cy={Math.max(10, Math.min(190, moodY))} r="4" className="chart-dot-secondary">
                                                        <title>{`${new Date(entry.date).toLocaleDateString('en-IN')}: Mood ${entry.moodScore || 0}`}</title>
                                                    </circle>
                                                    <text x={x} y="212" textAnchor="middle" className="trend-axis">{new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                                        <div className="chart-tooltip">
                                            <span className="inline-block w-3 h-3 rounded-full bg-[var(--accent-teal)]" />
                                            <span>Task Completion</span>
                                        </div>
                                        <div className="chart-tooltip">
                                            <span className="inline-block w-3 h-3 rounded-full bg-[var(--accent-amber)]" />
                                            <span>Mood Score</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="history-list mt-4">
                            {historyData.map((day) => (
                                <div key={day.date} className="history-item">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                        <p className="text-xs muted-text mt-1">{day.totalTasks || 0} total tasks · {day.doneTasks || 0} completed</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="metric-inline-value">{day.completionRate ?? '--'}%</p>
                                        <p className="text-xs muted-text">Mood {day.moodScore ?? '--'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}
            </main>

            <ReportViewer
                report={report}
                reportHistory={reportHistory}
                loading={reportLoading}
                generating={generatingReport}
                onGenerate={handleGenerateReport}
                onOpen={openReportPdf}
                open={drawerOpen}
                onClose={() => setActiveTab('today')}
            />
        </div>
    );
};

export default GuardianDashboard;

