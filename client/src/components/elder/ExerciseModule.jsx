import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import useMediaPipe from '../../hooks/useMediaPipe';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';
import { evaluateExerciseFrame, resolveExerciseProfile, createRepTracker } from '../../utils/exerciseEngine';

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const ExerciseModule = ({ task, onComplete, onClose }) => {
    const profile = useMemo(() => resolveExerciseProfile(task), [task]);
    const targetReps = profile.targetReps;
    const { speak } = useVoice();

    const [phase, setPhase] = useState('intro');
    const [reps, setReps] = useState(0);
    const [feedback, setFeedback] = useState('Stand where the camera can see your full movement.');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [accuracy, setAccuracy] = useState(0);
    const [statusLabel, setStatusLabel] = useState('ready');
    const [userAngle, setUserAngle] = useState(null);
    const [referenceAngle, setReferenceAngle] = useState(null);

    const timerRef = useRef(null);
    const repTrackerRef = useRef(createRepTracker());  // cycle-based rep state
    const lastSpokenFeedbackRef = useRef(0);
    const accuracySamplesRef = useRef([]);

    const handlePose = useCallback((landmarks) => {
        const result = evaluateExerciseFrame(landmarks, getAngle, profile, repTrackerRef.current);
        setFeedback(result.feedback);
        setAccuracy(result.accuracy);
        setStatusLabel(result.status);
        setUserAngle(result.userAngle);
        setReferenceAngle(result.referenceAngle);

        if (result.ready) {
            accuracySamplesRef.current.push(result.accuracy);
            if (accuracySamplesRef.current.length > 180) {
                accuracySamplesRef.current.shift();
            }
        }

        // Count rep only when the full cycle completes (engine tracks the phase)
        if (result.repDetected) {
            setReps((current) => {
                const next = current + 1;
                speak(next >= targetReps ? 'Final rep complete. Great work.' : `${next} reps done. Keep going.`);
                return next;
            });
        }

        const now = Date.now();
        if (phase === 'active' && now - lastSpokenFeedbackRef.current > 5000 && result.ready) {
            if (result.status === 'incorrect' || result.status === 'adjust') {
                lastSpokenFeedbackRef.current = now;
                speak(result.feedback);
            }
        }
    }, [phase, profile, speak, targetReps]);

    const { videoRef, canvasRef, status, error, getAngle, stop } = useMediaPipe({
        onPoseResult: handlePose,
        enabled: phase === 'active'
    });

    useEffect(() => {
        if (phase !== 'active') return undefined;
        timerRef.current = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [phase]);

    useEffect(() => {
        if (reps < targetReps || phase !== 'active') return;

        clearInterval(timerRef.current);
        stop();
        setPhase('done');
        speak('Excellent work. Exercise complete and ready to be marked done.');
    }, [phase, reps, speak, stop, targetReps]);

    useEffect(() => () => {
        clearInterval(timerRef.current);
        stop();
    }, [stop]);

    const startExercise = () => {
        accuracySamplesRef.current = [];
        repTrackerRef.current = createRepTracker();  // reset cycle state
        setReps(0);
        setElapsedSeconds(0);
        setAccuracy(0);
        setFeedback(profile.instruction);
        setPhase('active');
        speak(`Starting ${profile.name}. ${profile.instruction}`);
    };

    const handleEarlyStop = async (reason) => {
        stop();
        clearInterval(timerRef.current);
        speak('That is okay. Rest well and try again later if you feel better.');
        await api.put(`/schedule/task/${task.taskId}`, { status: 'refused', refusalReason: reason });
        onClose();
    };

    const handleComplete = async () => {
        const scores = accuracySamplesRef.current;
        const avgAccuracy = scores.length
            ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1))
            : 0;

        await api.put(`/schedule/task/${task.taskId}`, {
            status: 'done',
            notes: `Completed ${reps} reps in ${elapsedSeconds}s with ${avgAccuracy}% average accuracy`
        });
        onComplete?.();
        onClose();
    };

    const avgAccuracy = accuracySamplesRef.current.length
        ? Number((accuracySamplesRef.current.reduce((sum, value) => sum + value, 0) / accuracySamplesRef.current.length).toFixed(1))
        : 0;

    const progress = Math.min((reps / targetReps) * 100, 100);
    const accentClass = statusLabel === 'correct' ? 'bg-emerald-500/90' : statusLabel === 'adjust' ? 'bg-amber-500/90' : 'bg-slate-900/85';
    const referenceVideo = profile.videos?.[0];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'var(--bg-cream)',
            overflowY: 'auto',
        }}>
            <div style={{ width: '100%', minHeight: '100%', overflowY: 'auto' }}>
                <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', maxWidth: 1400, padding: '16px' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                        background: 'var(--bg-card)', padding: '16px 24px',
                        boxShadow: 'var(--shadow-card)',
                    }}>
                        <div>
                            <p className="eyebrow">Guided Exercise</p>
                            <h2 className="section-title mt-1">{profile.name}</h2>
                            <p className="section-subtitle mt-1">{task?.title}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {phase === 'active' ? (
                                <span className="chart-tooltip font-mono">{formatTime(elapsedSeconds)}</span>
                            ) : null}
                            <button
                                onClick={() => {
                                    stop();
                                    onClose();
                                }}
                                className="range-pill"
                                aria-label="Close exercise"
                            >
                                Exit
                            </button>
                        </div>
                    </div>

                    {phase === 'intro' ? (
                        <div style={{ display: 'grid', flex: 1, gap: 16, padding: '16px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
                            <section style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 24, boxShadow: 'var(--shadow-card)' }}>
                                <p className="eyebrow">Exercise Flow</p>
                                <h3 className="section-title mt-2">Reference demo and live pose scoring</h3>
                                <p className="section-subtitle mt-3">{profile.instruction}</p>

                                <div style={{ marginTop: 24, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 16 }}>
                                        <p className="metric-label">Target Reps</p>
                                        <p className="metric-inline-value" style={{ marginTop: 8 }}>{targetReps}</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 16 }}>
                                        <p className="metric-label">Accuracy Goal</p>
                                        <p className="metric-inline-value" style={{ marginTop: 8 }}>{profile.targetAccuracy}%</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 16 }}>
                                        <p className="metric-label">{profile.metricLabel}</p>
                                        <p className="metric-inline-value" style={{ marginTop: 8 }}>{profile.idealRange[0]}-{profile.idealRange[1]}°</p>
                                    </div>
                                </div>

                                <div style={{ marginTop: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-muted)', padding: 12 }}>
                                    {referenceVideo ? (
                                        <>
                                            <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <iframe
                                                    src={referenceVideo.embedUrl}
                                                    title={referenceVideo.title}
                                                    style={{ aspectRatio: '16/9', width: '100%', display: 'block' }}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            </div>
                                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                <div>
                                                    <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-heading)' }}>{referenceVideo.title}</p>
                                                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>Reference movement from the exercise package</p>
                                                </div>
                                                {profile.videos[1] ? (
                                                    <a
                                                        href={profile.videos[1].embedUrl.replace('/embed/', '/watch?v=')}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="range-pill"
                                                    >
                                                        Backup Demo
                                                    </a>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ padding: 20 }}>
                                            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Reference video unavailable. The module will still use pose-angle scoring live.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 24, boxShadow: 'var(--shadow-card)' }}>
                                <p className="eyebrow">Before You Start</p>
                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[
                                        { title: 'Camera setup', body: 'Place the phone or laptop so your full movement is visible. Sit or stand in the center of the frame.' },
                                        { title: 'Posture reminder', body: profile.postureHint },
                                        { title: 'Safety', body: 'Stop immediately if there is pain, dizziness, chest discomfort, or unusual shortness of breath.' },
                                    ].map((tip) => (
                                        <div key={tip.title} style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                                            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>{tip.title}</p>
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{tip.body}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        onClick={startExercise}
                                        className="header-pill-button"
                                        aria-label="Start exercise"
                                    >
                                        Start Exercise
                                    </button>
                                    <button
                                        onClick={() => handleEarlyStop('Too tired to exercise today')}
                                        className="range-pill"
                                        aria-label="Skip exercise"
                                    >
                                        I cannot do this now
                                    </button>
                                </div>
                            </section>
                        </div>
                    ) : null}

                    {phase === 'active' ? (
                        <div style={{ display: 'grid', flex: 1, gap: 16, padding: '16px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
                            <section style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="eyebrow">Reference Coach</p>
                                        <h3 className="section-title mt-1">{profile.name} Demo</h3>
                                    </div>
                                    <span className="chart-tooltip">{profile.metricLabel}</span>
                                </div>

                                <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-[#050b17]">
                                    {referenceVideo ? (
                                        <iframe
                                            src={referenceVideo.embedUrl}
                                            title={referenceVideo.title}
                                            className="aspect-video w-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    ) : (
                                        <div className="flex aspect-video items-center justify-center text-sm muted-text">
                                            Reference video unavailable
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                    {[
                                        { label: 'Target Angle', value: `${profile.idealRange[0]}-${profile.idealRange[1]}°` },
                                        { label: 'Reference Angle', value: `${referenceAngle ?? '--'}°` },
                                        { label: 'Avg Accuracy', value: `${avgAccuracy}%` },
                                        { label: 'Current Angle', value: `${userAngle ?? '--'}°` },
                                    ].map((m) => (
                                        <div key={m.label} style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                                            <p className="metric-label">{m.label}</p>
                                            <p className="metric-inline-value" style={{ marginTop: 8 }}>{m.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 16 }}>
                                <div className="relative min-h-[420px] overflow-hidden rounded-[24px] border border-white/10 bg-black">
                                    <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                                    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

                                    {status === 'loading' ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                            <div className="text-center">
                                                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-teal)] border-t-transparent" />
                                                <p className="text-sm text-white">Loading live pose detection...</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {status === 'error' ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6">
                                            <div className="max-w-sm text-center">
                                                <p className="text-lg font-semibold text-white">Camera Error</p>
                                                <p className="mt-2 text-sm muted-text">{error}</p>
                                                <button
                                                    onClick={() => handleEarlyStop('Camera not available')}
                                                    className="header-pill-button mt-4"
                                                >
                                                    Skip Exercise
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-3">
                                        <div className="chart-tooltip">
                                            <span className="metric-label">Status</span>
                                            <span className="ml-2 text-white capitalize">{statusLabel}</span>
                                        </div>
                                        <div className="chart-tooltip">
                                            <span className="metric-label">Accuracy</span>
                                            <span className="ml-2 text-white">{accuracy}%</span>
                                        </div>
                                        <div className="chart-tooltip">
                                            <span className="metric-label">Reps</span>
                                            <span className="ml-2 text-white">{reps}/{targetReps}</span>
                                        </div>
                                    </div>

                                    <div className={`absolute bottom-4 left-4 right-4 rounded-[20px] px-4 py-3 text-center ${accentClass}`}>
                                        <p className="text-sm font-semibold text-white">{feedback}</p>
                                    </div>
                                </div>

                                <div style={{ marginTop: 14, display: 'grid', gap: 12, gridTemplateColumns: 'auto 1fr auto', alignItems: 'center' }}>
                                    <div style={{ padding: '14px 16px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center', minWidth: 70 }}>
                                        <p className="metric-label">Progress</p>
                                        <p style={{ marginTop: 8, fontSize: '2.2rem', fontWeight: 700, color: 'var(--teal-deep)', lineHeight: 1 }}>{reps}</p>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>of {targetReps} reps</p>
                                    </div>

                                    <div style={{ padding: 14, background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-heading)' }}>Session Progress</p>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatTime(elapsedSeconds)}</span>
                                        </div>
                                        <div style={{ marginTop: 12, height: 10, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 6, background: 'var(--teal-deep)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
                                        </div>
                                        <p style={{ marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>Rep counter synced with angle detection.</p>
                                    </div>

                                    <button
                                        onClick={() => handleEarlyStop('Feeling tired or pain')}
                                        className="emergency-inline-button h-fit"
                                        aria-label="Stop exercise due to pain or fatigue"
                                    >
                                        Stop / Pain
                                    </button>
                                </div>
                            </section>
                        </div>
                    ) : null}

                    {phase === 'done' ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                            <section style={{ width: '100%', maxWidth: 560, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 40, textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
                                <p className="eyebrow">Exercise Complete</p>
                                <h2 className="section-title mt-2">Well done.</h2>
                                <p className="section-subtitle mt-3">The live session matched your reference exercise logic and is ready to be saved.</p>

                                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Exercise</p>
                                        <p className="metric-inline-value mt-3">{profile.name}</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Reps</p>
                                        <p className="metric-inline-value mt-3">{reps}/{targetReps}</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Avg Accuracy</p>
                                        <p className="metric-inline-value mt-3">{avgAccuracy}%</p>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap justify-center gap-3">
                                    <button
                                        onClick={handleComplete}
                                        className="header-pill-button"
                                        aria-label="Mark exercise as complete"
                                    >
                                        Mark Complete
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="range-pill"
                                        aria-label="Close completed exercise"
                                    >
                                        Close
                                    </button>
                                </div>
                            </section>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default ExerciseModule;
