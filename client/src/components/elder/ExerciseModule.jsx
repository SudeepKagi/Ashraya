// FILE: client/src/components/elder/ExerciseModule.jsx
import { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe from '../../hooks/useMediaPipe';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';

// Exercise definitions — landmarks to watch + form rules
const EXERCISES = {
    breathing_and_arm_raises: {
        name: 'Arm Raises',
        target: 6,
        instruction: 'Raise both arms above your head slowly, then lower them.',
        checkForm: (landmarks, getAngle) => {
            if (!landmarks) return { feedback: 'Getting ready...', good: false, rep: false };
            const L = landmarks;
            // Left shoulder angle: wrist(15) - shoulder(11) - hip(23)
            const leftAngle = getAngle(L[15], L[11], L[23]);
            // Right shoulder angle: wrist(16) - shoulder(12) - hip(24)
            const rightAngle = getAngle(L[16], L[12], L[24]);

            if (!leftAngle || !rightAngle) return { feedback: 'Step back so your full body is visible.', good: false, rep: false };

            const avg = (leftAngle + rightAngle) / 2;
            if (avg > 150) return { feedback: '✅ Arms up! Hold for a moment.', good: true, rep: true };
            if (avg > 90) return { feedback: 'Keep raising your arms higher!', good: false, rep: false };
            return { feedback: 'Slowly raise both arms above your head.', good: false, rep: false };
        }
    },
    seated_leg_raises: {
        name: 'Seated Leg Raises',
        target: 6,
        instruction: 'Sit straight, raise one leg at a time until it is parallel to the floor.',
        checkForm: (landmarks, getAngle) => {
            if (!landmarks) return { feedback: 'Getting ready...', good: false, rep: false };
            const L = landmarks;
            const leftKnee = getAngle(L[23], L[25], L[27]);
            const rightKnee = getAngle(L[24], L[26], L[28]);
            if (!leftKnee || !rightKnee) return { feedback: 'Move back so your full legs are visible.', good: false, rep: false };
            const maxAngle = Math.max(leftKnee, rightKnee);
            if (maxAngle > 160) return { feedback: '✅ Great! Leg fully extended.', good: true, rep: true };
            if (maxAngle > 120) return { feedback: 'Extend your leg a bit more!', good: false, rep: false };
            return { feedback: 'Raise one leg straight out in front of you.', good: false, rep: false };
        }
    },
    neck_stretches: {
        name: 'Neck Stretches',
        target: 4,
        instruction: 'Slowly tilt your head to the left, hold, then to the right.',
        checkForm: (landmarks) => {
            if (!landmarks) return { feedback: 'Getting ready...', good: false, rep: false };
            const nose = landmarks[0];
            const leftEar = landmarks[7];
            const rightEar = landmarks[8];
            if (!nose || !leftEar || !rightEar) return { feedback: 'Look toward the camera.', good: false, rep: false };
            const tilt = Math.abs(leftEar.y - rightEar.y);
            if (tilt > 0.08) return { feedback: '✅ Good stretch! Hold it.', good: true, rep: true };
            return { feedback: 'Slowly tilt your head to the left or right.', good: false, rep: false };
        }
    }
};

const ExerciseModule = ({ task, onComplete, onClose }) => {
    const [phase, setPhase] = useState('intro'); // intro | active | done
    const [reps, setReps] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [inGoodForm, setInGoodForm] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const lastRepState = useRef(false);
    const timerRef = useRef(null);

    const exerciseKey = task?.exerciseType || 'breathing_and_arm_raises';
    const exercise = EXERCISES[exerciseKey] || EXERCISES['breathing_and_arm_raises'];

    const { speak } = useVoice();

    const handlePose = useCallback((landmarks) => {
        const result = exercise.checkForm(landmarks, getAngle);
        setFeedback(result.feedback);
        setInGoodForm(result.good);

        // Count rep on rising edge (was false, now true)
        if (result.rep && !lastRepState.current) {
            setReps(prev => {
                const next = prev + 1;
                speak(next % 2 === 0 ? `${next} reps. Keep going!` : 'Good!');
                return next;
            });
        }
        lastRepState.current = result.rep;
    }, [exercise]);

    const { videoRef, canvasRef, status, error, getAngle, stop } = useMediaPipe({
        onPoseResult: handlePose,
        enabled: phase === 'active'
    });

    // Timer
    useEffect(() => {
        if (phase !== 'active') return;
        timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [phase]);

    // Auto-complete when target reps hit
    useEffect(() => {
        if (reps >= exercise.target && phase === 'active') {
            clearInterval(timerRef.current);
            stop();
            speak('Excellent work! Exercise complete. Well done!');
            setPhase('done');
        }
    }, [reps, exercise.target, phase]);

    const startExercise = () => {
        speak(`Starting ${exercise.name}. ${exercise.instruction}`);
        setPhase('active');
    };

    const handleEarlyStop = async (reason) => {
        stop();
        clearInterval(timerRef.current);
        speak('That is okay. Rest well.');
        await api.put(`/schedule/task/${task.taskId}`, { status: 'refused', refusalReason: reason });
        onClose();
    };

    const handleComplete = async () => {
        await api.put(`/schedule/task/${task.taskId}`, { status: 'done', notes: `Completed ${reps} reps in ${elapsedSeconds}s` });
        onComplete?.();
        onClose();
    };

    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
                <div>
                    <p className="text-white font-semibold">{exercise.name}</p>
                    <p className="text-gray-400 text-xs">{task?.title}</p>
                </div>
                <div className="flex items-center gap-3">
                    {phase === 'active' && (
                        <span className="text-gray-300 text-sm font-mono">{formatTime(elapsedSeconds)}</span>
                    )}
                    <button onClick={() => { stop(); onClose(); }} className="text-gray-400 hover:text-white text-sm" aria-label="Close exercise">✕ Exit</button>
                </div>
            </div>

            {/* Intro phase */}
            {phase === 'intro' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-gray-900">
                    <div className="text-6xl mb-6">🏃</div>
                    <h2 className="text-white text-2xl font-bold mb-3">{exercise.name}</h2>
                    <p className="text-gray-300 mb-2">{exercise.instruction}</p>
                    <p className="text-indigo-400 font-semibold mb-8">Target: {exercise.target} reps</p>
                    <div className="bg-gray-800 rounded-2xl p-4 mb-8 text-left w-full max-w-sm">
                        <p className="text-yellow-400 text-sm font-semibold mb-2">⚠️ Before you start</p>
                        <ul className="text-gray-300 text-sm space-y-1">
                            <li>• Make sure you have enough space around you</li>
                            <li>• Stop immediately if you feel pain or dizziness</li>
                            <li>• Keep your phone/camera stable and at eye level</li>
                        </ul>
                    </div>
                    <button
                        onClick={startExercise}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl text-lg transition-colors"
                        aria-label="Start exercise"
                    >
                        Start Exercise
                    </button>
                    <button
                        onClick={() => handleEarlyStop('Too tired to exercise today')}
                        className="mt-4 text-gray-500 hover:text-gray-300 text-sm"
                        aria-label="Skip exercise"
                    >
                        I can't do this today
                    </button>
                </div>
            )}

            {/* Active phase */}
            {phase === 'active' && (
                <div className="flex-1 flex flex-col">
                    {/* Camera + skeleton */}
                    <div className="relative flex-1 bg-black">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

                        {/* Loading overlay */}
                        {status === 'loading' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
                                <div className="text-center">
                                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-white text-sm">Loading pose detection...</p>
                                </div>
                            </div>
                        )}

                        {/* Error overlay */}
                        {status === 'error' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 p-6">
                                <div className="text-center">
                                    <p className="text-red-400 text-lg font-semibold mb-2">Camera Error</p>
                                    <p className="text-gray-300 text-sm mb-4">{error}</p>
                                    <button onClick={() => handleEarlyStop('Camera not available')} className="bg-gray-700 text-white px-4 py-2 rounded-xl text-sm">
                                        Skip Exercise
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Feedback overlay */}
                        {status === 'ready' && (
                            <div className={`absolute bottom-4 left-4 right-4 rounded-xl px-4 py-3 text-center transition-colors ${inGoodForm ? 'bg-emerald-600' : 'bg-gray-900 bg-opacity-80'}`}>
                                <p className="text-white text-sm font-semibold">{feedback}</p>
                            </div>
                        )}
                    </div>

                    {/* Rep counter bar */}
                    <div className="bg-gray-900 px-4 py-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-white">{reps}</p>
                                <p className="text-gray-400 text-xs">of {exercise.target} reps</p>
                            </div>
                            <div className="flex-1 mx-4">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                    <div
                                        className="bg-indigo-500 h-3 rounded-full transition-all"
                                        style={{ width: `${Math.min((reps / exercise.target) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => handleEarlyStop('Feeling tired or pain')}
                                className="bg-red-900 hover:bg-red-800 text-red-300 text-xs font-semibold px-3 py-2 rounded-xl"
                                aria-label="Stop exercise due to pain or fatigue"
                            >
                                I feel pain / tired
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Done phase */}
            {phase === 'done' && (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 px-6 text-center">
                    <div className="text-7xl mb-6">🎉</div>
                    <h2 className="text-white text-3xl font-bold mb-2">Great Job!</h2>
                    <p className="text-gray-300 mb-1">{reps} reps completed</p>
                    <p className="text-gray-400 text-sm mb-8">Time: {formatTime(elapsedSeconds)}</p>
                    <div className="w-full max-w-xs bg-gray-800 rounded-2xl p-4 mb-8 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Exercise</span>
                            <span className="text-white font-medium">{exercise.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Reps done</span>
                            <span className="text-emerald-400 font-medium">{reps} / {exercise.target}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Duration</span>
                            <span className="text-white font-medium">{formatTime(elapsedSeconds)}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleComplete}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-10 rounded-2xl text-lg transition-colors"
                        aria-label="Mark exercise as complete"
                    >
                        ✓ Mark Complete
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExerciseModule;