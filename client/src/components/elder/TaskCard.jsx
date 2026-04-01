// FILE: client/src/components/elder/TaskCard.jsx
import { useState, lazy, Suspense } from 'react';
import api from '../../services/api';
import useVoice from '../../hooks/useVoice';

const ExerciseModule = lazy(() => import('./ExerciseModule'));
const MedicineVerifier = lazy(() => import('./MedicineVerifier'));
const EmotionCheckin = lazy(() => import('./EmotionCheckin'));

const TYPE_META = {
    water: { icon: '💧', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700' },
    medicine: { icon: '💊', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700' },
    exercise: { icon: '🏃', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
    meal: { icon: '🍽️', color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700' },
    checkin: { icon: '💬', color: 'bg-pink-50 border-pink-200', badge: 'bg-pink-100 text-pink-700' },
    bp_report: { icon: '❤️', color: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700' }
};

const STATUS_STYLE = {
    pending: 'bg-gray-100 text-gray-600',
    done: 'bg-emerald-100 text-emerald-700',
    skipped: 'bg-yellow-100 text-yellow-700',
    refused: 'bg-red-100 text-red-700'
};

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

    // Called when a module completes the task — refreshes stats from server
    const handleModuleComplete = async () => {
        try {
            const { data } = await api.get('/schedule/today');
            const updatedTask = data.schedule.tasks.find(t => t.taskId === task.taskId);
            if (updatedTask) onUpdate(updatedTask, data.stats);
        } catch {
            // fallback — just mark done locally
            onUpdate({ ...task, status: 'done' }, null);
        } finally {
            setActiveModule(null);
        }
    };

    // Called when modal is closed without completing
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
            <div className={`rounded-2xl border p-4 transition-all ${meta.color} ${isDone ? 'opacity-60' : ''} ${large ? 'p-5' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className={`${large ? 'text-3xl' : 'text-2xl'}`}>{meta.icon}</span>
                        <div>
                            <p className={`font-semibold text-gray-800 ${large ? 'text-lg' : 'text-sm'}`}>{task.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{task.scheduledTime} · {task.durationMinutes} min</p>
                        </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[task.status]}`}>
                        {task.status}
                    </span>
                </div>

                {task.instructions && (
                    <p className="text-gray-600 mt-2 text-xs leading-relaxed">{task.instructions}</p>
                )}

                {task.status === 'refused' && task.refusalReason && (
                    <p className="text-red-500 text-xs mt-1 italic">Reason: {task.refusalReason}</p>
                )}

                {(task.status === 'pending' || task.status === 'skipped') && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                            onClick={openModule}
                            disabled={loading}
                            aria-label={`Start ${task.title}`}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-xl disabled:opacity-50 transition-colors"
                        >
                            {loading ? '...' :
                                task.type === 'exercise' ? '▶ Start Exercise' :
                                    task.type === 'medicine' ? '📷 Verify Medicine' :
                                        task.type === 'checkin' ? '💬 Check-in' :
                                            '✓ Mark Done'}
                        </button>

                        <button
                            onClick={markSkipped}
                            disabled={loading}
                            aria-label="Skip task"
                            className="px-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs font-semibold py-2 rounded-xl transition-colors"
                        >
                            Skip
                        </button>

                        <button
                            onClick={() => setShowRefusal(!showRefusal)}
                            aria-label="Cannot do task"
                            className="px-3 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-2 rounded-xl transition-colors"
                        >
                            Can't do
                        </button>

                        <button
                            onClick={readAloud}
                            aria-label="Read task aloud"
                            className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold py-2 rounded-xl transition-colors"
                        >
                            🔊
                        </button>
                    </div>
                )}

                {showRefusal && (
                    <div className="mt-3 space-y-2">
                        <input
                            value={refusalReason}
                            onChange={e => setRefusalReason(e.target.value)}
                            placeholder="Why can't you do this? (e.g. feeling tired, knee pain)"
                            className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
                            aria-label="Reason for not completing task"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={submitRefusal}
                                disabled={!refusalReason.trim() || loading}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-2 rounded-xl disabled:opacity-50 transition-colors"
                            >
                                Submit
                            </button>
                            <button
                                onClick={() => { setShowRefusal(false); setRefusalReason(''); }}
                                className="px-4 bg-gray-100 text-gray-600 text-xs py-2 rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals rendered OUTSIDE the card div so they cover full screen properly */}
            <Suspense fallback={null}>
                {activeModule === 'exercise' && (
                    <ExerciseModule
                        task={task}
                        onComplete={handleModuleComplete}
                        onClose={handleModuleClose}
                    />
                )}
                {activeModule === 'medicine' && (
                    <MedicineVerifier
                        task={task}
                        prescribedMedicines={prescribedMedicines}
                        onComplete={handleModuleComplete}
                        onClose={handleModuleClose}
                    />
                )}
                {activeModule === 'checkin' && (
                    <EmotionCheckin
                        task={task}
                        onComplete={handleModuleComplete}
                        onClose={handleModuleClose}
                    />
                )}
            </Suspense>
        </>
    );
};

export default TaskCard;