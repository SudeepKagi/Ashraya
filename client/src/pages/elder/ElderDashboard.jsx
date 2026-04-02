// FILE: client/src/pages/elder/ElderDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import TaskCard from '../../components/elder/TaskCard';
import FallDetector from '../../components/elder/FallDetector';
import SOSButton from '../../components/common/SOSButton';
import VoiceAssistant from '../../components/common/VoiceAssistant';
import useVoice from '../../hooks/useVoice';
import useNotifications from '../../hooks/useNotifications';
import { useAccessibility } from '../../context/AccessibilityContext';

const IconBase = ({ children }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        {children}
    </svg>
);

const ActivityIcon = () => <IconBase><path d="M4 13h4l2-5 4 10 2-5h4" /></IconBase>;
const SparkIcon = () => <IconBase><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" /></IconBase>;
const ExitIcon = () => <IconBase><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></IconBase>;
const ShieldIcon = () => <IconBase><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" /></IconBase>;

const getNow = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const getStatusClass = (value, goodThreshold = 70, warningThreshold = 40) => {
    if (value >= goodThreshold) return 'status-normal';
    if (value >= warningThreshold) return 'status-warning';
    return 'status-critical';
};

const VitalTile = ({ label, value, unit, statusClass, trend, icon, className = 'span-4' }) => (
    <article className={`vital-card ${className}`}>
        <div className="metric-header">
            <div className="metric-icon">{icon}</div>
            <span className={`status-badge ${statusClass}`}>
                <span className="status-dot" />
                {statusClass === 'status-normal' ? 'Normal' : statusClass === 'status-warning' ? 'Watch' : 'Urgent'}
            </span>
        </div>
        <p className="metric-label">{label}</p>
        <div className="metric-body">
            <span className="vital-value">{value}</span>
            <span className="metric-unit">{unit}</span>
        </div>
        <div className="metric-footer mt-5">
            <span className="metric-trend">{trend}</span>
            <svg viewBox="0 0 88 32" className="metric-sparkline" aria-hidden="true">
                <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points="0,22 16,18 32,20 48,14 64,16 88,12" className="text-[var(--accent-teal)]" />
            </svg>
        </div>
    </article>
);

const ElderDashboard = () => {
    const { user, logout } = useAuth();
    const { speak } = useVoice();
    const { requestPermission, showNotification } = useNotifications();
    const { settings } = useAccessibility();

    const [schedule, setSchedule] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [currentTime, setCurrentTime] = useState(getNow());
    const [elderProfile, setElderProfile] = useState(null);
    const [liveWatchVitals, setLiveWatchVitals] = useState({ hr: null, spo2: null, bp: null, battery: null, source: 'idle' });

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(getNow()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        requestPermission();
    }, []);

    const fetchSchedule = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/schedule/today');
            setSchedule(data.schedule);
            setStats(data.stats);

            const profileRes = await api.get('/elder/profile');
            setElderProfile(profileRes.data.elder);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load schedule');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

    useEffect(() => {
        if (!loading && schedule && user && !settings.hearingImpaired) {
            const pending = schedule.tasks.filter((t) => t.status === 'pending');
            speak(`${getGreeting()}, ${user.name}! You have ${pending.length} tasks today.`);
        }
    }, [loading, schedule, user, settings.hearingImpaired, speak]);

    const handleTaskUpdate = (updatedTask, newStats) => {
        setSchedule((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.taskId === updatedTask.taskId ? updatedTask : t))
        }));
        if (newStats) {
            setStats(newStats);
        }
        if (updatedTask.status === 'done') {
            showNotification('Task Done', `${updatedTask.title} completed!`);
        }
    };

    const nextTask = schedule?.tasks
        .filter((t) => t.status === 'pending')
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

    const filteredTasks = schedule?.tasks.filter((t) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'pending') return t.status === 'pending';
        if (activeFilter === 'done') return t.status === 'done';
        return t.type === activeFilter;
    }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    const completionRate = stats?.completionRate || 0;
    const pendingCount = stats?.pending || 0;
    const moodIndicator = completionRate >= 75 ? 'Steady' : completionRate >= 45 ? 'Support' : 'Watch';

    return (
        <div className={`dashboard-shell elder-shell ${settings.simplifiedUI ? 'text-base' : ''}`}>
            <header className="dashboard-topbar elder-topbar">
                <div className="topbar-patient">
                    <span className="topbar-title">Ashraya</span>
                    <span className="topbar-subtitle">{user?.name || 'Ashraya User'} • Personal Care Plan • {currentTime}</span>
                </div>

                <div className="topbar-actions">
                    <button onClick={logout} className="logout-pill elder-logout-pill" aria-label="Logout">
                        <ExitIcon />
                        <span className="ml-2">Logout</span>
                    </button>
                </div>
            </header>

            <main className="dashboard-main elder-main">
                {error ? (
                    <div className="glass-panel p-4 mb-4 text-sm critical-text">
                        {error}
                        <button onClick={fetchSchedule} className="ml-3 underline text-white">Retry</button>
                    </div>
                ) : null}

                {(settings.hearingImpaired || settings.audioOnly || settings.simplifiedUI) ? (
                    <div className="glass-panel p-4 mb-4">
                        <p className="eyebrow">Accessibility</p>
                        <p className="text-sm text-white mt-2">Supportive accessibility modes are active to keep reminders, controls, and prompts clearer.</p>
                    </div>
                ) : null}

                <section className="summary-shell mb-4">
                    <div className="summary-hero">
                        <div>
                            <p className="eyebrow">Personal Companion</p>
                            <h1 className="section-title mt-2">{getGreeting()}, {user?.name?.split(' ')[0] || 'friend'}</h1>
                            <p className="section-subtitle mt-2">Your assistant keeps reminders, check-ins, medicine support, and guardian safety monitoring running in the background all day.</p>
                            <div className="care-banner mt-5">
                                <div className="care-banner-icon">
                                    <SparkIcon />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Voice-first daily support</p>
                                    <p className="text-xs muted-text mt-1">Automatic reminders, calm check-ins, and supportive spoken replies are active.</p>
                                </div>
                            </div>
                        </div>
                        <div className="stats-row w-full max-w-[420px]">
                            <div className="stat-block">
                                <p className="metric-label">Done</p>
                                <p className="metric-inline-value mt-2">{stats?.done || 0}</p>
                            </div>
                            <div className="stat-block">
                                <p className="metric-label">Pending</p>
                                <p className="metric-inline-value mt-2">{pendingCount}</p>
                            </div>
                            <div className="stat-block">
                                <p className="metric-label">Progress</p>
                                <p className="metric-inline-value mt-2">{completionRate}%</p>
                            </div>
                            <div className="stat-block">
                                <p className="metric-label">Mood</p>
                                <p className="metric-inline-value mt-2">{moodIndicator}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="dashboard-grid">
                    <VitalTile
                        label="Task Completion"
                        value={completionRate}
                        unit="%"
                        statusClass={getStatusClass(completionRate, 75, 45)}
                        trend="Daily routine adherence"
                        icon={<ActivityIcon />}
                        className="span-3"
                    />
                    <VitalTile
                        label="Heart Rate"
                        value={liveWatchVitals.hr ?? '--'}
                        unit="bpm"
                        statusClass={getStatusClass(Number(liveWatchVitals.hr || 70), 90, 60)}
                        trend="Latest smartwatch reading"
                        icon={<ActivityIcon />}
                        className="span-3"
                    />
                    <VitalTile
                        label="SpO2"
                        value={liveWatchVitals.spo2 ?? '--'}
                        unit="%"
                        statusClass={getStatusClass(Number(liveWatchVitals.spo2 || 97), 95, 92)}
                        trend="Live oxygen estimate"
                        icon={<ShieldIcon />}
                        className="span-3"
                    />
                    <VitalTile
                        label="Blood Pressure"
                        value={liveWatchVitals.bp?.systolic && liveWatchVitals.bp?.diastolic ? `${liveWatchVitals.bp.systolic}/${liveWatchVitals.bp.diastolic}` : '--/--'}
                        unit="mmHg"
                        statusClass={
                            !liveWatchVitals.bp?.systolic || !liveWatchVitals.bp?.diastolic
                                ? 'status-warning'
                                : liveWatchVitals.bp?.systolic >= 180 || liveWatchVitals.bp?.diastolic >= 120
                                ? 'status-critical'
                                : liveWatchVitals.bp?.systolic >= 140 || liveWatchVitals.bp?.diastolic >= 90
                                    ? 'status-warning'
                                    : 'status-normal'
                        }
                        trend={liveWatchVitals.source === 'simulation' ? 'Demo BP for watch mode' : 'Latest BP reading'}
                        icon={<ShieldIcon />}
                        className="span-3"
                    />
                    <section className="glass-panel span-6 p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <p className="eyebrow">Safety Monitoring</p>
                                <h2 className="section-title mt-1">Watch and SOS</h2>
                                <p className="section-subtitle mt-1">Bluetooth watch connection, fall detection, and emergency protection.</p>
                            </div>
                            <div className="chart-tooltip">Battery {liveWatchVitals.battery ?? '--'}%</div>
                        </div>
                        <FallDetector
                            hearingImpaired={Boolean(settings.hearingImpaired || elderProfile?.accessibility?.hearingImpaired)}
                            onVitalsUpdate={setLiveWatchVitals}
                        />
                    </section>

                    <section className="glass-panel span-6 p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <p className="eyebrow">Up Next</p>
                                <h2 className="section-title mt-1">Upcoming Task</h2>
                                <p className="section-subtitle mt-1">Your assistant will remind you automatically when it is time.</p>
                            </div>
                            <div className="chart-tooltip">{nextTask?.scheduledTime || 'No pending task'}</div>
                        </div>
                        {loading ? (
                            <div className="h-40 rounded-[20px] bg-white/5 animate-pulse" />
                        ) : nextTask ? (
                            <TaskCard
                                task={nextTask}
                                onUpdate={handleTaskUpdate}
                                large
                                prescribedMedicines={elderProfile?.profile?.medicines || []}
                            />
                        ) : (
                            <div className="glass-panel p-5">
                                <p className="text-sm text-white">Everything for today is complete. You are doing well.</p>
                            </div>
                        )}
                    </section>

                    <section className="chart-shell span-12">
                        <div className="chart-header">
                            <div>
                                <p className="eyebrow">Task Board</p>
                                <h2 className="section-title">Daily Schedule</h2>
                                <p className="section-subtitle">All reminders, medicines, exercise tasks, and check-ins in one place.</p>
                            </div>
                            <div className="range-tabs">
                                {['all', 'pending', 'done', 'medicine', 'exercise', 'meal', 'water', 'checkin'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setActiveFilter(filter)}
                                        aria-pressed={activeFilter === filter}
                                        className={`range-pill ${activeFilter === filter ? 'active' : ''}`}
                                    >
                                        {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-[20px] bg-white/5 animate-pulse" />)}
                            </div>
                        ) : !schedule ? (
                            <div className="text-center py-12">
                                <p className="text-sm muted-text">No schedule yet for today.</p>
                            </div>
                        ) : filteredTasks?.length === 0 ? (
                            <p className="text-center muted-text py-10">No tasks in this category.</p>
                        ) : (
                            <div className="space-y-3">
                                {filteredTasks.map((task) => (
                                    <TaskCard
                                        key={task.taskId}
                                        task={task}
                                        onUpdate={handleTaskUpdate}
                                        prescribedMedicines={elderProfile?.profile?.medicines || []}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <VoiceAssistant />
            <SOSButton />
        </div>
    );
};

export default ElderDashboard;
