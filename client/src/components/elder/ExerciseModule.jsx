import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import useMediaPipe from '../../hooks/useMediaPipe';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';
import { evaluateExerciseFrame, resolveExerciseProfile } from '../../utils/exerciseEngine';

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
    const repActiveRef = useRef(false);
    const lastSpokenFeedbackRef = useRef(0);
    const accuracySamplesRef = useRef([]);

    const handlePose = useCallback((landmarks) => {
        const result = evaluateExerciseFrame(landmarks, getAngle, profile);
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

        const repQualified = result.repDetected && result.accuracy >= profile.targetAccuracy;
        if (repQualified && !repActiveRef.current) {
            repActiveRef.current = true;
            setReps((current) => {
                const next = current + 1;
                speak(next >= targetReps ? 'Final rep complete. Great work.' : `${next} reps done. Keep going.`);
                return next;
            });
        } else if (!result.repDetected || result.status === 'incorrect') {
            repActiveRef.current = false;
        }

        const now = Date.now();
        if (phase === 'active' && now - lastSpokenFeedbackRef.current > 4500 && result.ready) {
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
        repActiveRef.current = false;
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
        <div className="fixed inset-0 z-50 bg-[rgba(6,11,23,0.96)] backdrop-blur-xl">
            <div className="h-full w-full overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-4 lg:px-6">
                    <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
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
                        <div className="grid flex-1 gap-4 py-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                                <p className="eyebrow">Exercise Flow</p>
                                <h3 className="section-title mt-2">Reference demo and live pose scoring</h3>
                                <p className="section-subtitle mt-3">{profile.instruction}</p>

                                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Target Reps</p>
                                        <p className="metric-inline-value mt-3">{targetReps}</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Accuracy Goal</p>
                                        <p className="metric-inline-value mt-3">{profile.targetAccuracy}%</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">{profile.metricLabel}</p>
                                        <p className="metric-inline-value mt-3">{profile.idealRange[0]}-{profile.idealRange[1]}°</p>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-[24px] border border-white/10 bg-[#050b17] p-3">
                                    {referenceVideo ? (
                                        <>
                                            <div className="overflow-hidden rounded-[20px] border border-white/10">
                                                <iframe
                                                    src={referenceVideo.embedUrl}
                                                    title={referenceVideo.title}
                                                    className="aspect-video w-full"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            </div>
                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{referenceVideo.title}</p>
                                                    <p className="text-xs muted-text mt-1">Reference movement from the exercise package</p>
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
                                        <div className="glass-panel p-5">
                                            <p className="text-sm text-white">Reference video unavailable. The module will still use pose-angle scoring live.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                                <p className="eyebrow">Before You Start</p>
                                <div className="mt-4 space-y-4">
                                    <div className="glass-panel p-4">
                                        <p className="text-sm font-semibold text-white">Camera setup</p>
                                        <p className="text-sm muted-text mt-2">Place the phone or laptop so your full movement is visible. Sit or stand in the center of the frame.</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="text-sm font-semibold text-white">Posture reminder</p>
                                        <p className="text-sm muted-text mt-2">{profile.postureHint}</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="text-sm font-semibold text-white">Safety</p>
                                        <p className="text-sm muted-text mt-2">Stop immediately if there is pain, dizziness, chest discomfort, or unusual shortness of breath.</p>
                                    </div>
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
                        <div className="grid flex-1 gap-4 py-4 lg:grid-cols-[0.9fr_1.1fr]">
                            <section className="rounded-[28px] border border-white/10 bg-white/5 p-4">
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

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Target Angle</p>
                                        <p className="metric-inline-value mt-3">{profile.idealRange[0]}-{profile.idealRange[1]}°</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Reference Angle</p>
                                        <p className="metric-inline-value mt-3">{referenceAngle ?? '--'}°</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Average Accuracy</p>
                                        <p className="metric-inline-value mt-3">{avgAccuracy}%</p>
                                    </div>
                                    <div className="glass-panel p-4">
                                        <p className="metric-label">Current Angle</p>
                                        <p className="metric-inline-value mt-3">{userAngle ?? '--'}°</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-[28px] border border-white/10 bg-white/5 p-4">
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

                                <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                                    <div className="glass-panel p-4 text-center">
                                        <p className="metric-label">Progress</p>
                                        <p className="mt-3 text-4xl font-semibold text-white">{reps}</p>
                                        <p className="text-xs muted-text mt-1">of {targetReps} reps</p>
                                    </div>

                                    <div className="glass-panel p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-white">Session Progress</p>
                                            <span className="text-xs muted-text">{formatTime(elapsedSeconds)}</span>
                                        </div>
                                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-[var(--accent-teal)] transition-all"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="mt-3 text-sm muted-text">The rep counter follows the same angle-difference idea as your Python session tracker.</p>
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
                        <div className="flex flex-1 items-center justify-center py-6">
                            <section className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-8 text-center">
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
