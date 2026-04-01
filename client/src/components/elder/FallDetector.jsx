// FILE: client/src/components/elder/FallDetector.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import useBluetooth from '../../hooks/useBluetooth';
import useVoice from '../../hooks/useVoice';
import { getSocket } from '../../services/socketService';
import api from '../../services/api';

const FALL_SPIKE = 2.5;   // g — impact threshold
const STILL_THRESH = 0.5; // g — stillness threshold
const WINDOW_MS = 1500;   // ms — fall detection window
const CONFIRM_SECS = 60;  // seconds before auto-alert

const FallDetector = ({ hearingImpaired = false, onVitalsUpdate }) => {
    const { connected, status, error, vitals, connect, disconnect,
        simulateFall, registerSampleCallback, isSimulating } = useBluetooth();
    const { speak } = useVoice();

    const [fallDetected, setFallDetected] = useState(false);
    const [countdown, setCountdown] = useState(CONFIRM_SECS);
    const [alertSent, setAlertSent] = useState(false);

    const countdownRef = useRef(null);
    const spikeTimeRef = useRef(null);
    const spikeDetectedRef = useRef(false);

    // Stream vitals to parent + API every 5s
    const streamIntervalRef = useRef(null);
    const pendingVitalsRef = useRef({});

    // Notify parent component about vitals (for dashboard display)
    useEffect(() => {
        if (onVitalsUpdate && vitals.hr !== null) {
            onVitalsUpdate(vitals);
        }
    }, [vitals, onVitalsUpdate]);

    // Stream watch data to backend every 5 seconds
    useEffect(() => {
        if (!connected) {
            clearInterval(streamIntervalRef.current);
            return;
        }
        streamIntervalRef.current = setInterval(async () => {
            const v = pendingVitalsRef.current;
            if (!v.hr && !v.spo2 && !v.accel) return; // nothing to send
            try {
                await api.post('/health/watch-stream', {
                    hr: v.hr,
                    spo2: v.spo2,
                    accel: v.accel,
                    steps: v.steps
                });
            } catch (e) {
                console.warn('Watch stream error:', e.message);
            }
        }, 5000);
        return () => clearInterval(streamIntervalRef.current);
    }, [connected]);

    // Listen for guardian-side fall cancellation
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const handler = () => cancelAlert();
        socket.on('fall_cancelled', handler);
        return () => socket.off('fall_cancelled', handler);
    }, []);

    // Wire accelerometer samples into fall detector + vitals
    useEffect(() => {
        registerSampleCallback((sample) => {
            // Route to pending vitals buffer for streaming
            if (sample.type === 'hr') {
                pendingVitalsRef.current.hr = sample.value;
            } else if (sample.type === 'spo2') {
                pendingVitalsRef.current.spo2 = sample.value;
            } else if (sample.type === 'accel') {
                pendingVitalsRef.current.accel = { x: sample.x, y: sample.y, z: sample.z };
                processFallSample(sample);
            }
        });
    }, [registerSampleCallback]);

    const processFallSample = (sample) => {
        const { x = 0, y = 0, z = 0 } = sample;
        const R = Math.sqrt(x * x + y * y + z * z);

        if (!spikeDetectedRef.current && R > FALL_SPIKE) {
            spikeDetectedRef.current = true;
            spikeTimeRef.current = Date.now();
            return;
        }

        if (spikeDetectedRef.current) {
            const elapsed = Date.now() - spikeTimeRef.current;
            if (elapsed > WINDOW_MS) {
                spikeDetectedRef.current = false;
                spikeTimeRef.current = null;
                return;
            }
            if (R < STILL_THRESH) {
                spikeDetectedRef.current = false;
                spikeTimeRef.current = null;
                triggerFallAlert();
            }
        }
    };

    const triggerFallAlert = useCallback(() => {
        setFallDetected(true);
        setCountdown(CONFIRM_SECS);
        setAlertSent(false);
        if (!hearingImpaired) speak("Did you fall? Say I'm okay or tap the button if you're fine.");
        startCountdown();
    }, [hearingImpaired, speak]);

    const startCountdown = useCallback(() => {
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    sendFallAlert();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const cancelAlert = useCallback(() => {
        clearInterval(countdownRef.current);
        setFallDetected(false);
        setAlertSent(false);
        setCountdown(CONFIRM_SECS);
        const socket = getSocket();
        socket?.emit('elder_ok', { elderId: 'self' });
        if (!hearingImpaired) speak("Glad you're okay! Alert cancelled.");
    }, [hearingImpaired, speak]);

    const sendFallAlert = useCallback(async () => {
        try {
            await api.post('/health/fall-alert', { type: 'fall', confirmedByElder: false });
            setAlertSent(true);
            if (!hearingImpaired) speak('Alert sent to your guardian. Help is on the way.');
        } catch (err) {
            console.error('Fall alert failed:', err.message);
        }
    }, [hearingImpaired, speak]);

    useEffect(() => () => {
        clearInterval(countdownRef.current);
        clearInterval(streamIntervalRef.current);
    }, []);

    // ── Fall confirmation overlay ──────────────────────────────────────────
    if (fallDetected) {
        return (
            <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center p-6 text-white">
                <div className="text-6xl mb-4 animate-bounce">🚨</div>
                <h1 className={`font-bold text-center mb-2 ${hearingImpaired ? 'text-5xl' : 'text-3xl'}`}>
                    Did you fall?
                </h1>
                {!alertSent ? (
                    <>
                        <p className={`text-center text-red-100 mb-8 ${hearingImpaired ? 'text-2xl' : 'text-base'}`}>
                            Guardian alerted in{' '}
                            <span className="font-bold text-white text-4xl">{countdown}s</span>
                        </p>
                        <button
                            onClick={cancelAlert}
                            aria-label="I am okay, cancel alert"
                            className={`bg-white text-red-600 font-bold rounded-2xl shadow-xl active:scale-95 transition-transform
                                ${hearingImpaired ? 'w-64 h-32 text-4xl' : 'w-48 h-20 text-2xl'}`}
                        >
                            ✅ I'm Okay
                        </button>
                        {hearingImpaired && (
                            <button
                                onClick={sendFallAlert}
                                aria-label="Send help alert now"
                                className="mt-6 w-64 h-32 bg-red-800 text-white font-bold rounded-2xl text-4xl shadow-xl active:scale-95 transition-transform"
                            >
                                🆘 Help Me
                            </button>
                        )}
                    </>
                ) : (
                    <div className="text-center mt-4 space-y-2">
                        <p className="text-3xl font-bold">✅ Alert Sent</p>
                        <p className="text-red-100 text-lg">Your guardian has been notified. Stay calm.</p>
                    </div>
                )}
            </div>
        );
    }

    // ── Idle: connect panel + live vitals ────────────────────────────────
    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            {/* Connection row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">⌚</span>
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Smartwatch</p>
                        <p className={`text-xs font-medium mt-0.5 ${status === 'connected' ? 'text-emerald-500' :
                                status === 'simulating' ? 'text-blue-500' :
                                    status === 'connecting' ? 'text-yellow-500' :
                                        status === 'error' ? 'text-red-500' : 'text-gray-400'
                            }`}>
                            {status === 'connected' ? '● Live — real watch' :
                                status === 'simulating' ? '● Simulation mode' :
                                    status === 'connecting' ? '● Connecting...' :
                                        status === 'error' ? '● Connection failed' : '● Not connected'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={connected ? disconnect : connect}
                    aria-label={connected ? 'Disconnect smartwatch' : 'Connect smartwatch'}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
                        ${connected
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                >
                    {connected ? 'Disconnect' : 'Connect Watch'}
                </button>
            </div>

            {/* Live vitals row */}
            {connected && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-red-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-red-600">
                            {vitals.hr ? `${vitals.hr}` : '––'}
                        </p>
                        <p className="text-xs text-red-400">HR bpm</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-blue-600">
                            {vitals.spo2 ? `${vitals.spo2}%` : '––'}
                        </p>
                        <p className="text-xs text-blue-400">SpO2</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-green-600">
                            {vitals.battery ? `${vitals.battery}%` : '––'}
                        </p>
                        <p className="text-xs text-green-400">Battery</p>
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-400 leading-relaxed">{error}</p>}

            {/* Demo fall trigger button (simulation only) */}
            {isSimulating && (
                <button
                    onClick={simulateFall}
                    aria-label="Simulate a fall for demo"
                    className="w-full text-xs bg-orange-50 text-orange-600 font-semibold py-2 rounded-lg border border-orange-200 hover:bg-orange-100"
                >
                    🎭 Demo: Simulate Fall
                </button>
            )}
        </div>
    );
};

export default FallDetector;