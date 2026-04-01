// FILE: client/src/components/elder/FallDetector.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import useBluetooth from '../../hooks/useBluetooth';
import useVoice from '../../hooks/useVoice';
import { FallDetector as FallDetectorService } from '../../services/fallDetection';
import { getSocket } from '../../services/socketService';
import api from '../../services/api';

const CONFIRM_SECONDS = 60;

const FallDetector = ({ hearingImpaired = false }) => {
    const { connected, status, error, connect, disconnect, registerSampleCallback } = useBluetooth();
    const { speak } = useVoice();

    const [fallDetected, setFallDetected] = useState(false);
    const [countdown, setCountdown] = useState(CONFIRM_SECONDS);
    const [alertSent, setAlertSent] = useState(false);

    const countdownRef = useRef(null);
    const detectorRef = useRef(null);

    // Listen for guardian-side cancellation (elder_ok → fall_cancelled)
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        socket.on('fall_cancelled', () => {
            cancelAlert();
        });

        return () => socket.off('fall_cancelled');
    }, []);

    // Init fall detector
    useEffect(() => {
        detectorRef.current = new FallDetectorService(handleFallDetected);
    }, []);

    // Wire accelerometer samples → detector
    useEffect(() => {
        registerSampleCallback((sample) => {
            detectorRef.current?.processSample(sample);
        });
    }, [registerSampleCallback]);

    const handleFallDetected = useCallback(() => {
        setFallDetected(true);
        setCountdown(CONFIRM_SECONDS);
        setAlertSent(false);

        if (!hearingImpaired) {
            speak("Did you fall? Say I'm okay or tap the button if you're fine.");
        }

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
        setCountdown(CONFIRM_SECONDS);
        if (!hearingImpaired) speak("Glad you're okay! Alert cancelled.");
    }, [hearingImpaired, speak]);

    const sendFallAlert = useCallback(async () => {
        try {
            await api.post('/health/fall-alert', {
                type: 'fall',
                confirmedByElder: false
            });
            setAlertSent(true);
            if (!hearingImpaired) speak('Alert sent to your guardian. Help is on the way.');
        } catch (err) {
            console.error('Fall alert failed:', err.message);
        }
    }, [hearingImpaired, speak]);

    useEffect(() => {
        return () => {
            clearInterval(countdownRef.current);
            disconnect();
        };
    }, [disconnect]);

    // — Idle state: connect/disconnect button —
    if (!fallDetected) {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⌚</span>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Fall Detection</p>
                            <p className={`text-xs font-medium mt-0.5 ${status === 'connected' ? 'text-emerald-500' :
                                    status === 'connecting' ? 'text-yellow-500' :
                                        status === 'error' ? 'text-red-500' : 'text-gray-400'
                                }`}>
                                {status === 'connected' ? '● Connected to watch' :
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
                {error && (
                    <p className="text-xs text-red-400 mt-2 leading-relaxed">{error}</p>
                )}
            </div>
        );
    }

    // — Fall confirmed: fullscreen alert —
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
};

export default FallDetector;