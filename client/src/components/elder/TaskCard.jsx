// FILE: client/src/components/elder/TaskCard.jsx
import { useState, lazy, Suspense } from 'react';
import api from '../../services/api';
import useVoice from '../../hooks/useVoice';

const ExerciseModule = lazy(() => import('./ExerciseModule'));
const MedicineVerifier = lazy(() => import('./MedicineVerifier'));
const EmotionCheckin = lazy(() => import('./EmotionCheckin'));

const TYPE_META = {
    water: { label: 'Hydration', accent: 'status-normal', action: 'Mark Done' },
    medicine: { label: 'Medication', accent: 'status-warning', action: 'Verify Medicine' },
    exercise: { label: 'Exercise', accent: 'status-normal', action: 'Start Exercise' },
    meal: { label: 'Meal', accent: 'status-warning', action: 'Mark Done' },
    checkin: { label: 'Check-in', accent: 'status-normal', action: 'Check In' },
    bp_report: { label: 'BP Report', accent: 'status-critical', action: 'Mark Done' }
};

const STATUS_STYLE = {
    pending: 'status-warning',
    done: 'status-normal',
    skipped: 'status-warning',
    refused: 'status-critical'
};

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
    </svg>
);

const TaskCard = ({ task, onUpdate, large = false, prescribedMedicines = [] }) => {
    const [loading, setLoading] = useState(false);
    const [showRefusal, setShowRefusal] = useState(false);
    const [refusalReason, setRefusalReason] = useState('');
    const [activeModule, setActiveModule] = useState(null);
    const { speak } = useVoice();

    const meta = TYPE_META[task.type] || TYPE_META.water;
    const isDone = task.status === 'done';

    const markDone = async () => {
        if (isDone || loading) return;
        setLoading(true);
        try {
            const { data } = await api.put(`/schedule/task/${task.taskId}`, { status: 'done' });
            speak(`${task.title} marked as done. Well done!`);
            onUpdate(data.task, data.stats);
        } catch (err) {
            console.error('Task update failed:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const markSkipped = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const { data } = await api.put(`/schedule/task/${task.taskId}`, { status: 'skipped' });
            onUpdate(data.task, data.stats);
        } catch (err) {
            console.error('Skip failed:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const submitRefusal = async () => {
        if (!refusalReason.trim() || loading) return;
        setLoading(true);
        try {
            const { data } = await api.put(`/schedule/task/${task.taskId}`, {
                status: 'refused',
                refusalReason
            });
            onUpdate(data.task, data.stats);
            setShowRefusal(false);
            setRefusalReason('');
        } catch (err) {
            console.error('Refuse failed:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleModuleComplete = async () => {
        try {
            const { data } = await api.get('/schedule/today');
            const updatedTask = data.schedule.tasks.find((t) => t.taskId === task.taskId);
            if (updatedTask) onUpdate(updatedTask, data.stats);
        } catch {
            onUpdate({ ...task, status: 'done' }, null);
        } finally {
            setActiveModule(null);
        }
    };

    const handleModuleClose = () => {
        setActiveModule(null);
    };

    const readAloud = () => {
        speak(`${task.title}. Scheduled at ${task.scheduledTime}. ${task.instructions || ''}`);
    };

    const openModule = () => {
        if (task.type === 'exercise') setActiveModule('exercise');
        else if (task.type === 'medicine') setActiveModule('medicine');
        else if (task.type === 'checkin') setActiveModule('checkin');
        else markDone();
    };

    return (
        <>
            <article className={`vital-card ${large ? 'p-7' : ''} ${isDone ? 'opacity-75' : ''}`}>
                <div className="metric-header">
                    <div className="metric-icon"><ClockIcon /></div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`status-badge ${meta.accent}`}>{meta.label}</span>
                        <span className={`status-badge ${STATUS_STYLE[task.status]}`}>{task.status}</span>
                    </div>
                </div>

                <p className="metric-label">Scheduled Task</p>
                <div className="metric-body">
                    <span className="vital-value text-[var(--text-primary)] text-[clamp(1.7rem,3vw,2.4rem)]">{task.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-4 text-sm muted-text">
                    <span className="metric-inline-value text-[var(--text-primary)] text-base">{task.scheduledTime}</span>
                    <span>{task.durationMinutes} min</span>
                </div>

                {task.instructions ? (
                    <p className="text-sm muted-text leading-6 mt-4">{task.instructions}</p>
                ) : null}

                {task.status === 'refused' && task.refusalReason ? (
                    <p className="text-sm critical-text mt-3">Reason: {task.refusalReason}</p>
                ) : null}

                {(task.status === 'pending' || task.status === 'skipped') ? (
                    <div className="flex flex-wrap gap-2 mt-5">
                        <button
                            onClick={openModule}
                            disabled={loading}
                            aria-label={`Start ${task.title}`}
                            className="header-pill-button"
                        >
                            {loading ? 'Working...' : meta.action}
                        </button>

                        <button
                            onClick={markSkipped}
                            disabled={loading}
                            aria-label="Skip task"
                            className="range-pill"
                        >
                            Skip
                        </button>

                        <button
                            onClick={() => setShowRefusal(!showRefusal)}
                            aria-label="Cannot do task"
                            className="range-pill"
                        >
                            Cannot Do
                        </button>

                        <button
                            onClick={readAloud}
                            aria-label="Read task aloud"
                            className="range-pill"
                        >
                            Read Aloud
                        </button>
                    </div>
                ) : null}

                {showRefusal ? (
                    <div className="mt-4 space-y-3">
                        <input
                            value={refusalReason}
                            onChange={(e) => setRefusalReason(e.target.value)}
                            placeholder="Share why this task is difficult right now"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                            aria-label="Reason for not completing task"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={submitRefusal}
                                disabled={!refusalReason.trim() || loading}
                                className="header-pill-button"
                            >
                                Submit
                            </button>
                            <button
                                onClick={() => { setShowRefusal(false); setRefusalReason(''); }}
                                className="range-pill"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : null}
            </article>

            <Suspense fallback={null}>
                {activeModule === 'exercise' ? (
                    <ExerciseModule task={task} onComplete={handleModuleComplete} onClose={handleModuleClose} />
                ) : null}
                {activeModule === 'medicine' ? (
                    <MedicineVerifier task={task} prescribedMedicines={prescribedMedicines} onComplete={handleModuleComplete} onClose={handleModuleClose} />
                ) : null}
                {activeModule === 'checkin' ? (
                    <EmotionCheckin task={task} onComplete={handleModuleComplete} onClose={handleModuleClose} />
                ) : null}
            </Suspense>
        </>
    );
};

export default TaskCard;
