import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import TaskCard from '../../components/elder/TaskCard';
import SOSButton from '../../components/common/SOSButton';
import VoiceAssistant from '../../components/common/VoiceAssistant';
import useVoice from '../../hooks/useVoice';
import useNotifications from '../../hooks/useNotifications';

const TYPE_ORDER = ['medicine', 'bp_report', 'exercise', 'meal', 'checkin', 'water'];

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

const ElderDashboard = () => {
    const { user, logout } = useAuth();
    const { speak } = useVoice();
    const { requestPermission, showNotification } = useNotifications();

    const [schedule, setSchedule] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [currentTime, setCurrentTime] = useState(getNow());
    const [elderProfile, setElderProfile] = useState(null);

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
        if (!loading && schedule && user) {
            const pending = schedule.tasks.filter(t => t.status === 'pending');
            speak(`${getGreeting()}, ${user.name}! You have ${pending.length} tasks today.`);
        }
    }, [loading]);

    const generateSchedule = async () => {
        setGenerating(true);
        setError('');
        try {
            const { data } = await api.post('/schedule/generate');
            setSchedule(data.schedule);
            setStats(data.stats);
            speak('Your schedule has been updated by AI.');
            showNotification('Ashraya', 'Your daily schedule is ready!');
        } catch (err) {
            setError(err.response?.data?.message || 'AI generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleTaskUpdate = (updatedTask, newStats) => {
        setSchedule(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.taskId === updatedTask.taskId ? updatedTask : t)
        }));
        setStats(newStats);
        if (updatedTask.status === 'done') {
            showNotification('✅ Task Done', `${updatedTask.title} completed!`);
        }
    };

    const nextTask = schedule?.tasks
        .filter(t => t.status === 'pending')
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

    const filteredTasks = schedule?.tasks.filter(t => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'pending') return t.status === 'pending';
        if (activeFilter === 'done') return t.status === 'done';
        return t.type === activeFilter;
    }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                            <span className="text-white text-sm font-bold">A</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Ashraya</p>
                            <p className="text-xs text-gray-400">{currentTime} · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={generateSchedule}
                            disabled={generating}
                            aria-label="Regenerate AI schedule"
                            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {generating ? '⏳ Generating...' : '✨ AI Schedule'}
                        </button>
                        <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors" aria-label="Log out">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-5 text-white">
                    <p className="text-indigo-200 text-sm">{getGreeting()},</p>
                    <h1 className="text-2xl font-bold mt-0.5">{user?.name?.split(' ')[0]} 👋</h1>
                    {stats && (
                        <p className="text-indigo-100 text-sm mt-2">
                            {stats.done} of {stats.total} tasks done · {stats.completionRate}% complete
                        </p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm" role="alert">
                        {error}
                        <button onClick={fetchSchedule} className="ml-2 underline font-medium">Retry</button>
                    </div>
                )}

                {stats && (
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'Done', value: stats.done, color: 'bg-emerald-50 text-emerald-700' },
                            { label: 'Pending', value: stats.pending, color: 'bg-blue-50 text-blue-700' },
                            { label: 'Skipped', value: stats.skipped, color: 'bg-yellow-50 text-yellow-700' },
                            { label: 'Progress', value: `${stats.completionRate}%`, color: 'bg-indigo-50 text-indigo-700' }
                        ].map(s => (
                            <div key={s.label} className={`${s.color} rounded-xl p-2.5 text-center`}>
                                <p className="text-lg font-bold">{s.value}</p>
                                <p className="text-xs font-medium opacity-70">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {nextTask && !loading && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-amber-600 mb-2">⏰ UP NEXT</p>
                        <TaskCard
                            task={nextTask}
                            onUpdate={handleTaskUpdate}
                            large
                            prescribedMedicines={elderProfile?.profile?.medicines || []}
                        />
                    </div>
                )}

                {stats && (
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Today's progress</span>
                            <span>{stats.completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${stats.completionRate}%` }}
                                role="progressbar"
                                aria-valuenow={stats.completionRate}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {['all', 'pending', 'done', 'medicine', 'exercise', 'meal', 'water', 'checkin'].map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            aria-pressed={activeFilter === f}
                            className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors
                ${activeFilter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : !schedule ? (
                    <div className="text-center py-10">
                        <p className="text-gray-500 text-sm mb-3">No schedule yet for today.</p>
                        <button
                            onClick={generateSchedule}
                            disabled={generating}
                            className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {generating ? 'Generating...' : '✨ Generate AI Schedule'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTasks?.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">No tasks in this category.</p>
                        ) : (
                            filteredTasks.map(task => (
                                <TaskCard
                                    key={task.taskId}
                                    task={task}
                                    onUpdate={handleTaskUpdate}
                                    prescribedMedicines={elderProfile?.profile?.medicines || []}
                                />
                            ))
                        )}
                    </div>
                )}
            </main>

            <VoiceAssistant />
            <SOSButton />
        </div>
    );
};

export default ElderDashboard;
