// FILE: client/src/components/elder/FallDetector.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import useBluetooth from '../../hooks/useBluetooth';
import useVoice from '../../hooks/useVoice';
import { getSocket } from '../../services/socketService';
import api from '../../services/api';

const FALL_SPIKE = 2.5;
const STILL_THRESH = 0.5;
const WINDOW_MS = 1500;
const CONFIRM_SECS = 60;

const WatchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="7" y="5" width="10" height="14" rx="3" />
        <path d="M9 2h6" />
        <path d="M9 22h6" />
        <path d="M10 9h4" />
        <path d="M12 9v4l2 1" />
    </svg>
);

const FallDetector = ({ hearingImpaired = false, onVitalsUpdate }) => {
    const {
        connected,
        status,
        error,
        vitals,
        connect,
        disconnect,
        simulateFall,
        startSimulation,
        registerSampleCallback,
        isSimulating
    } = useBluetooth();
    const { speak } = useVoice();

    const [fallDetected, setFallDetected] = useState(false);
    const [countdown, setCountdown] = useState(CONFIRM_SECS);
    const [alertSent, setAlertSent] = useState(false);

    const countdownRef = useRef(null);
    const spikeTimeRef = useRef(null);
    const spikeDetectedRef = useRef(false);
    const streamIntervalRef = useRef(null);
    const pendingVitalsRef = useRef({});

    useEffect(() => {
        if (onVitalsUpdate && vitals.hr !== null) {
            onVitalsUpdate(vitals);
        }
    }, [vitals, onVitalsUpdate]);

    useEffect(() => {
        pendingVitalsRef.current = {
            ...pendingVitalsRef.current,
            hr: vitals.hr ?? pendingVitalsRef.current.hr,
            spo2: vitals.spo2 ?? pendingVitalsRef.current.spo2,
            bp: vitals.bp ?? pendingVitalsRef.current.bp,
            steps: vitals.steps ?? pendingVitalsRef.current.steps,
            battery: vitals.battery ?? pendingVitalsRef.current.battery,
            source: vitals.source ?? pendingVitalsRef.current.source
        };
    }, [vitals]);

    useEffect(() => {
        if (!connected) {
            clearInterval(streamIntervalRef.current);
            return;
        }

        streamIntervalRef.current = setInterval(async () => {
            const buffered = pendingVitalsRef.current;
            if (
                buffered.hr === undefined
                && buffered.spo2 === undefined
                && buffered.bp === undefined
                && buffered.accel === undefined
                && buffered.steps === undefined
                && buffered.battery === undefined
            ) return;

            try {
                await api.post('/health/watch-stream', {
                    hr: buffered.hr,
                    spo2: buffered.spo2,
                    bp: buffered.bp,
                    accel: buffered.accel,
                    steps: buffered.steps,
                    battery: buffered.battery,
                    source: buffered.source
                });
                pendingVitalsRef.current = {
                    hr: undefined,
                    spo2: undefined,
                    bp: undefined,
                    accel: undefined,
                    steps: undefined,
                    battery: undefined,
                    source: buffered.source
                };
            } catch (err) {
                console.warn('Watch stream error:', err.message);
            }
        }, 5000);

        return () => clearInterval(streamIntervalRef.current);
    }, [connected]);

    const cancelAlert = useCallback(() => {
        clearInterval(countdownRef.current);
        setFallDetected(false);
        setAlertSent(false);
        setCountdown(CONFIRM_SECS);
        getSocket()?.emit('elder_ok', { elderId: 'self' });
        if (!hearingImpaired) {
            speak('Glad you are okay. Alert cancelled.');
        }
    }, [hearingImpaired, speak]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return undefined;

        const handler = () => cancelAlert();
        socket.on('fall_cancelled', handler);
        return () => socket.off('fall_cancelled', handler);
    }, [cancelAlert]);

    const sendFallAlert = useCallback(async () => {
        try {
            await api.post('/health/fall-alert', { type: 'fall', confirmedByElder: false });
            setAlertSent(true);
            if (!hearingImpaired) {
                speak('Alert sent to your guardian. Help is on the way.');
            }
        } catch (err) {
            console.error('Fall alert failed:', err.message);
        }
    }, [hearingImpaired, speak]);

    const startCountdown = useCallback(() => {
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    sendFallAlert();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [sendFallAlert]);

    const triggerFallAlert = useCallback(() => {
        setFallDetected(true);
        setCountdown(CONFIRM_SECS);
        setAlertSent(false);
        if (!hearingImpaired) {
            speak("Did you fall? Say I'm okay or tap the button if you are fine.");
        }
        startCountdown();
    }, [hearingImpaired, speak, startCountdown]);

    const processFallSample = useCallback((sample) => {
        const { x = 0, y = 0, z = 0 } = sample;
        const resultant = Math.sqrt(x * x + y * y + z * z);

        if (!spikeDetectedRef.current && resultant > FALL_SPIKE) {
            spikeDetectedRef.current = true;
            spikeTimeRef.current = Date.now();
            return;
        }

        if (!spikeDetectedRef.current) return;

        const elapsed = Date.now() - spikeTimeRef.current;
        if (elapsed > WINDOW_MS) {
            spikeDetectedRef.current = false;
            spikeTimeRef.current = null;
            return;
        }

        if (resultant < STILL_THRESH) {
            spikeDetectedRef.current = false;
            spikeTimeRef.current = null;
            triggerFallAlert();
        }
    }, [triggerFallAlert]);

    useEffect(() => {
        registerSampleCallback((sample) => {
            if (sample.type === 'hr') {
                pendingVitalsRef.current.hr = sample.value;
            } else if (sample.type === 'spo2') {
                pendingVitalsRef.current.spo2 = sample.value;
            } else if (sample.type === 'bp') {
                pendingVitalsRef.current.bp = sample.value;
            } else if (sample.type === 'steps') {
                pendingVitalsRef.current.steps = sample.value;
            } else if (sample.type === 'accel') {
                pendingVitalsRef.current.accel = { x: sample.x, y: sample.y, z: sample.z };
                processFallSample(sample);
            }
        });
    }, [processFallSample, registerSampleCallback]);

    useEffect(() => () => {
        clearInterval(countdownRef.current);
        clearInterval(streamIntervalRef.current);
    }, []);

    if (fallDetected) {
        return (
            <div className="fall-overlay">
                <div className="fall-overlay-card">
                    <div className="fall-overlay-icon">!</div>
                    <p className="eyebrow">Emergency Check</p>
                    <h2 className="section-title mt-3 text-center text-[1.9rem]">Did you fall?</h2>
                    {!alertSent ? (
                        <>
                            <p className="section-subtitle mt-3 text-center">
                                Guardian will be alerted in <span className="text-white font-semibold">{countdown}s</span>.
                            </p>
                            <div className="fall-overlay-actions">
                                <button
                                    onClick={cancelAlert}
                                    aria-label="I am okay, cancel alert"
                                    className="header-pill-button min-w-[180px]"
                                >
                                    I&apos;m Okay
                                </button>
                                <button
                                    onClick={sendFallAlert}
                                    aria-label="Send emergency alert now"
                                    className="emergency-inline-button"
                                >
                                    Send Help Now
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="glass-panel p-5 mt-5 text-center">
                            <p className="text-base font-semibold text-white">Alert sent to guardian</p>
                            <p className="text-sm muted-text mt-2">Please stay calm. Help is on the way.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const connectionTone = status === 'connected'
        ? 'status-normal'
        : status === 'simulating' || status === 'connecting'
            ? 'status-warning'
            : 'status-critical';

    const connectionLabel = status === 'connected'
        ? 'Live'
        : status === 'simulating'
            ? 'Demo'
            : status === 'connecting'
                ? 'Pairing'
                : 'Offline';

    return (
        <div className="watch-card">
            <div className="watch-card-header">
                <div className="flex items-center gap-3">
                    <div className="metric-icon">
                        <WatchIcon />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">Smartwatch Safety Link</p>
                        <p className="text-xs muted-text mt-1">Live vitals, fall detection, and guardian escalation.</p>
                    </div>
                </div>
                <span className={`status-badge ${connectionTone}`}>
                    <span className="status-dot" />
                    {connectionLabel}
                </span>
            </div>

            <div className="watch-stats-grid">
                <div className="watch-stat">
                    <span className="metric-label">Heart Rate</span>
                    <span className="watch-stat-value">{vitals.hr ?? '--'}</span>
                    <span className="watch-stat-unit">bpm</span>
                </div>
                <div className="watch-stat">
                    <span className="metric-label">SpO2</span>
                    <span className="watch-stat-value">{vitals.spo2 ? `${vitals.spo2}` : '--'}</span>
                    <span className="watch-stat-unit">%</span>
                </div>
                <div className="watch-stat">
                    <span className="metric-label">Battery</span>
                    <span className="watch-stat-value">{vitals.battery ? `${vitals.battery}` : '--'}</span>
                    <span className="watch-stat-unit">%</span>
                </div>
                <div className="watch-stat">
                    <span className="metric-label">Blood Pressure</span>
                    <span className="watch-stat-value">
                        {vitals.bp?.systolic && vitals.bp?.diastolic ? `${vitals.bp.systolic}/${vitals.bp.diastolic}` : '--/--'}
                    </span>
                    <span className="watch-stat-unit">mmHg</span>
                </div>
            </div>

            {error ? <p className="critical-text text-xs leading-6">{error}</p> : null}
            <p className="text-xs muted-text">
                {isSimulating
                    ? 'Demo mode is generating watch vitals, battery, and fall movement for the live dashboards.'
                    : status === 'connected'
                        ? 'Connected to the current wearable. Heart rate and fall motion are live, while BP depends on device support.'
                        : 'Pair a compatible watch, or switch to demo mode for the hackathon flow.'}
            </p>

            <div className="watch-actions">
                <button
                    onClick={connected ? disconnect : connect}
                    aria-label={connected ? 'Disconnect smartwatch' : 'Connect smartwatch'}
                    className={connected ? 'range-pill' : 'header-pill-button'}
                >
                    {connected ? 'Disconnect Watch' : 'Connect Watch'}
                </button>

                {!connected ? (
                    <button
                        onClick={startSimulation}
                        aria-label="Start demo watch mode"
                        className="range-pill"
                    >
                        Start Demo Mode
                    </button>
                ) : null}

                {isSimulating ? (
                    <button
                        onClick={simulateFall}
                        aria-label="Simulate a fall for demo"
                        className="emergency-inline-button"
                    >
                        Demo Fall Trigger
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default FallDetector;
