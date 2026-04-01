// FILE: client/src/pages/guardian/GuardianDashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socketService';

const ALERT_ICONS = {
    fall_detected: '🚨',
    sos_triggered: '🆘',
    health_anomaly: '⚠️',
    emotion_alert: '💛',
    task_completed: '✅',
    watch_live: '💓'
};

const GuardianDashboard = () => {
    const { user, logout } = useAuth();
    const [elder, setElder] = useState(null);
    const [todayData, setTodayData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [liveVitals, setLiveVitals] = useState({ hr: null, spo2: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('today');

    // History data
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const alertsRef = useRef([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [elderRes, alertsRes] = await Promise.all([
                api.get('/guardian/elder'),
                api.get('/guardian/alerts?days=1&limit=20')
            ]);
            setElder(elderRes.data.elder);
            setTodayData(elderRes.data.today);
            alertsRef.current = alertsRes.data.alerts || [];
            setAlerts(alertsRef.current);

            // Seed live vitals from latest stored readings
            if (elderRes.data.today?.latestHR) {
                setLiveVitals(v => ({ ...v, hr: elderRes.data.today.latestHR }));
            }
            if (elderRes.data.today?.latestSpO2) {
                setLiveVitals(v => ({ ...v, spo2: elderRes.data.today.latestSpO2 }));
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load elder data');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const { data } = await api.get('/guardian/history');
            setHistory(data.history || []);
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
        if (activeTab === 'history' && history.length === 0) fetchHistory();
    }, [activeTab]);

    // Real-time socket events
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const addAlert = (type, data) => {
            const newAlert = {
                _id: `live_${Date.now()}`,
                type,
                ...data,
                timestamp: data.timestamp || new Date(),
                isAnomaly: true
            };
            alertsRef.current = [newAlert, ...alertsRef.current.slice(0, 29)];
            setAlerts([...alertsRef.current]);
        };

        socket.on('fall_detected', (data) => {
            addAlert('fall_detected', data);
            // Flash the browser tab title
            document.title = '🚨 FALL ALERT — Ashraya';
            setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000);
        });

        socket.on('sos_triggered', (data) => {
            addAlert('sos_triggered', data);
            document.title = '🆘 SOS — Ashraya';
            setTimeout(() => { document.title = 'Ashraya Guardian'; }, 10000);
        });

        socket.on('health_anomaly', (data) => {
            addAlert('health_anomaly', data);
        });

        socket.on('emotion_alert', (data) => {
            addAlert('emotion_alert', data);
        });

        socket.on('task_completed', (data) => {
            // Update task completion stats
            setTodayData(prev => prev ? {
                ...prev,
                stats: prev.stats ? {
                    ...prev.stats,
                    done: (prev.stats.done || 0) + 1,
                    pending: Math.max(0, (prev.stats.pending || 1) - 1)
                } : prev.stats
            } : prev);
        });

        socket.on('watch_live', (data) => {
            if (data.hr) setLiveVitals(v => ({ ...v, hr: data.hr }));
            if (data.spo2) setLiveVitals(v => ({ ...v, spo2: data.spo2 }));
        });

        return () => {
            ['fall_detected', 'sos_triggered', 'health_anomaly', 'emotion_alert', 'task_completed', 'watch_live']
                .forEach(e => socket.off(e));
        };
    }, []);

    const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const formatDate = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    const moodColor = (score) => {
        if (!score) return 'text-gray-400';
        if (score >= 7) return 'text-emerald-600';
        if (score >= 4) return 'text-yellow-600';
        return 'text-red-600';
    };

    const moodLabel = (score) => {
        if (!score) return 'No data';
        if (score >= 7) return '😊 Good';
        if (score >= 4) return '😐 Neutral';
        return '😟 Low';
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                            <span className="text-white text-sm font-bold">G</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Ashraya Guardian</p>
                            <p className="text-xs text-gray-400">Monitoring {elder?.name || '...'}</p>
                        </div>
                    </div>
                    <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500" aria-label="Logout">
                        Logout
                    </button>
                </div>

                {/* Tabs */}
                <div className="max-w-2xl mx-auto px-4 pb-0 flex gap-1 border-t border-gray-50">
                    {['today', 'alerts', 'history'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors
                                ${activeTab === tab
                                    ? 'border-emerald-500 text-emerald-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            {tab}
                            {tab === 'alerts' && alerts.length > 0 && (
                                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                    {alerts.filter(a => ['fall_detected', 'sos_triggered'].includes(a.type)).length || alerts.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-10">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm" role="alert">
                        {error} <button onClick={fetchData} className="ml-2 underline font-medium">Retry</button>
                    </div>
                )}

                {/* ── TODAY TAB ── */}
                {activeTab === 'today' && (
                    <div className="space-y-4">
                        {/* Elder header card */}
                        {elder && (
                            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-5 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-emerald-400 rounded-full flex items-center justify-center text-2xl font-bold">
                                        {elder.name?.[0]}
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold">{elder.name}</h1>
                                        <p className="text-emerald-100 text-sm">
                                            Age {elder.age} · {elder.profile?.diseases?.join(', ') || 'No conditions'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Live vitals */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                                <p className="text-xs text-gray-400 mb-1">Live Heart Rate</p>
                                <p className="text-3xl font-bold text-red-500">
                                    {liveVitals.hr ? `${liveVitals.hr}` : '––'}
                                    <span className="text-sm font-normal text-gray-400 ml-1">bpm</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Baseline: {elder?.baseline?.restingHR || '––'} bpm
                                </p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                                <p className="text-xs text-gray-400 mb-1">Live SpO2</p>
                                <p className="text-3xl font-bold text-blue-500">
                                    {liveVitals.spo2 ? `${liveVitals.spo2}` : '––'}
                                    <span className="text-sm font-normal text-gray-400 ml-1">%</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Baseline: {elder?.baseline?.avgSpO2 || '––'}%
                                </p>
                            </div>
                        </div>

                        {/* Today stats */}
                        {todayData?.stats && (
                            <div className="bg-white rounded-2xl p-4 border border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Today's Tasks
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Done', value: todayData.stats.done, color: 'text-emerald-600 bg-emerald-50' },
                                        { label: 'Pending', value: todayData.stats.pending, color: 'text-blue-600 bg-blue-50' },
                                        { label: 'Skipped', value: todayData.stats.skipped, color: 'text-yellow-600 bg-yellow-50' },
                                        { label: '%', value: `${todayData.stats.completionRate}%`, color: 'text-indigo-600 bg-indigo-50' },
                                    ].map(s => (
                                        <div key={s.label} className={`${s.color} rounded-xl p-2 text-center`}>
                                            <p className="text-lg font-bold">{s.value}</p>
                                            <p className="text-xs opacity-70">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-emerald-500 h-2 rounded-full transition-all"
                                        style={{ width: `${todayData.stats.completionRate}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Mood */}
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Today's Mood</p>
                                <p className={`text-2xl font-bold mt-1 ${moodColor(todayData?.moodScore)}`}>
                                    {moodLabel(todayData?.moodScore)}
                                </p>
                                {todayData?.moodScore && (
                                    <p className="text-xs text-gray-400 mt-0.5">{todayData.moodScore.toFixed(1)} / 10</p>
                                )}
                            </div>
                            <div className="text-4xl">{
                                !todayData?.moodScore ? '❔' :
                                    todayData.moodScore >= 7 ? '😊' :
                                        todayData.moodScore >= 4 ? '😐' : '😟'
                            }</div>
                        </div>

                        {/* Recent anomalies */}
                        {todayData?.anomalies?.length > 0 && (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                                    ⚠️ Today's Alerts ({todayData.anomalies.length})
                                </p>
                                <div className="space-y-2">
                                    {todayData.anomalies.slice(0, 3).map((a, i) => (
                                        <div key={i} className="text-sm text-red-700">
                                            <span className="font-medium">{formatTime(a.timestamp)}</span> — {a.anomalyReason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ALERTS TAB ── */}
                {activeTab === 'alerts' && (
                    <div className="space-y-2">
                        {alerts.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-4xl mb-2">✅</p>
                                <p className="text-sm">No alerts in the last 24 hours</p>
                            </div>
                        ) : alerts.map((alert, i) => {
                            const isCritical = alert.type === 'fall_detected' || alert.type === 'sos_triggered';
                            return (
                                <div key={alert._id || i}
                                    className={`rounded-2xl p-4 border ${isCritical ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{ALERT_ICONS[alert.type] || '📌'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold ${isCritical ? 'text-red-700' : 'text-gray-800'}`}>
                                                {alert.type === 'fall_detected' ? 'Fall Detected' :
                                                    alert.type === 'sos_triggered' ? 'SOS Triggered' :
                                                        alert.type === 'health_anomaly' ? `Health Alert — ${alert.value?.type || alert.type}` :
                                                            alert.type === 'emotion_alert' ? 'Mood Concern' :
                                                                alert.anomalyReason || 'Alert'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {alert.anomalyReason || alert.reason || alert.concern || ''}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-400 whitespace-nowrap">{formatTime(alert.timestamp)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── HISTORY TAB ── */}
                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {historyLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-sm">No history available yet</p>
                            </div>
                        ) : history.map((day, i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-700">
                                        {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs">
                                        {day.completionRate !== undefined && (
                                            <span className={`font-semibold ${day.completionRate >= 70 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                                                {day.completionRate}% tasks
                                            </span>
                                        )}
                                        {day.moodScore !== undefined && (
                                            <span className={`font-semibold ${moodColor(day.moodScore)}`}>
                                                {moodLabel(day.moodScore)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {day.completionRate !== undefined && (
                                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                                        <div
                                            className="bg-emerald-500 h-1.5 rounded-full"
                                            style={{ width: `${day.completionRate}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default GuardianDashboard;