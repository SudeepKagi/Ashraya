// FILE: client/src/hooks/useVoice.js
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const DEFAULT_DURATION_MS = 6000;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

const useVoice = ({ onResult, language = 'en-IN', durationMs = DEFAULT_DURATION_MS } = {}) => {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [supported, setSupported] = useState(false);
    const [error, setError] = useState('');
    const [provider, setProvider] = useState('none');

    const recognitionRef = useRef(null);
    const recognitionActiveRef = useRef(false);
    const startPendingRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const stopTimerRef = useRef(null);
    const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const resultHandlerRef = useRef(onResult);
    const micPermissionCheckedRef = useRef(false);

    useEffect(() => {
        resultHandlerRef.current = onResult;
    }, [onResult]);

    const cleanupRecorder = useCallback(() => {
        if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
        }
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
    }, []);

    const transcribeBlob = useCallback(async (blob) => {
        const audioBase64 = await blobToBase64(blob);
        const { data } = await api.post('/voice/transcribe', {
            audioBase64,
            mimeType: blob.type || 'audio/webm',
            language: language.split('-')[0] || 'en'
        });
        return data.text || '';
    }, [language]);

    useEffect(() => {
        const SpeechRecognitionCtor = typeof window !== 'undefined'
            ? window.SpeechRecognition || window.webkitSpeechRecognition
            : null;
        const canRecord = typeof window !== 'undefined'
            && typeof navigator !== 'undefined'
            && Boolean(navigator.mediaDevices?.getUserMedia)
            && typeof MediaRecorder !== 'undefined';

        if (SpeechRecognitionCtor) {
            const recognition = new SpeechRecognitionCtor();
            recognition.lang = language;
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                recognitionActiveRef.current = true;
                startPendingRef.current = false;
                setListening(true);
                setProvider('browser');
            };

            recognition.onresult = (event) => {
                const text = event.results?.[0]?.[0]?.transcript?.trim() || '';
                if (!text) return;
                setTranscript(text);
                if (resultHandlerRef.current) {
                    resultHandlerRef.current(text);
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                startPendingRef.current = false;
                recognitionActiveRef.current = false;
                setListening(false);
                if (event.error !== 'aborted') {
                    setError(event.error === 'network'
                        ? 'Browser speech service unavailable'
                        : `Speech recognition error: ${event.error}`);
                }
            };

            recognition.onend = () => {
                startPendingRef.current = false;
                recognitionActiveRef.current = false;
                setListening(false);
            };

            recognitionRef.current = recognition;
        }

        setSupported(Boolean(SpeechRecognitionCtor) || canRecord);

        return () => {
            if (stopTimerRef.current) {
                clearTimeout(stopTimerRef.current);
            }
            const recognition = recognitionRef.current;
            if (recognition && (recognitionActiveRef.current || startPendingRef.current)) {
                try {
                    recognition.abort();
                } catch {
                    // ignore browser cleanup errors
                }
            }
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== 'inactive') {
                recorder.stop();
            }
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, [cleanupRecorder, language]);

    const startRecorderFallback = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            setProvider('server');
            setListening(true);

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                setError(event.error?.message || 'Could not record audio');
                setListening(false);
                cleanupRecorder();
            };

            recorder.onstop = async () => {
                try {
                    const blob = new Blob(audioChunksRef.current, { type: mimeType });
                    if (blob.size === 0) {
                        setListening(false);
                        cleanupRecorder();
                        return;
                    }

                    const text = await transcribeBlob(blob);
                    setTranscript(text);
                    if (resultHandlerRef.current && text) {
                        resultHandlerRef.current(text);
                    }
                } catch (err) {
                    setError(err.response?.data?.message || err.message || 'Transcription failed');
                } finally {
                    setListening(false);
                    cleanupRecorder();
                }
            };

            recorder.start();
            stopTimerRef.current = window.setTimeout(() => {
                const activeRecorder = mediaRecorderRef.current;
                if (activeRecorder && activeRecorder.state === 'recording') {
                    activeRecorder.stop();
                }
            }, durationMs);
        } catch (err) {
            setError(err.message || 'Could not access microphone');
            setListening(false);
            cleanupRecorder();
        }
    }, [cleanupRecorder, durationMs, transcribeBlob]);

    const ensureMicrophoneAccess = useCallback(async () => {
        if (micPermissionCheckedRef.current) {
            return true;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            micPermissionCheckedRef.current = true;
            return true;
        } catch (err) {
            setError(err.message || 'Microphone permission is required');
            return false;
        }
    }, []);

    const startListening = useCallback(async () => {
        if (!supported || listening) return;
        setTranscript('');
        setError('');

        if (synthRef.current?.speaking) {
            synthRef.current.cancel();
        }

        const hasMicAccess = await ensureMicrophoneAccess();
        if (!hasMicAccess) {
            return;
        }

        const recognition = recognitionRef.current;
        if (recognition && !recognitionActiveRef.current && !startPendingRef.current) {
            try {
                startPendingRef.current = true;
                recognition.start();
                return;
            } catch (err) {
                console.warn('Browser recognition start failed, falling back:', err.message);
                startPendingRef.current = false;
            }
        }

        await startRecorderFallback();
    }, [ensureMicrophoneAccess, listening, startRecorderFallback, supported]);

    const stopListening = useCallback(() => {
        const recognition = recognitionRef.current;
        if (recognition && (recognitionActiveRef.current || startPendingRef.current)) {
            try {
                recognition.abort();
            } catch {
                // ignore browser stop errors
            } finally {
                startPendingRef.current = false;
                recognitionActiveRef.current = false;
            }
            return;
        }

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            recorder.stop();
        } else {
            setListening(false);
            cleanupRecorder();
        }
    }, [cleanupRecorder]);

    const speak = useCallback((text, options = {}) => {
        if (!synthRef.current) return Promise.resolve();
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = options.rate || 0.92;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;
        return new Promise((resolve) => {
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            synthRef.current.speak(utterance);
        });
    }, [language]);

    const stopSpeaking = useCallback(() => {
        synthRef.current?.cancel();
    }, []);

    const resetTranscript = useCallback(() => setTranscript(''), []);

    return {
        listening,
        transcript,
        supported,
        error,
        provider,
        startListening,
        stopListening,
        speak,
        stopSpeaking,
        resetTranscript
    };
};

export default useVoice;
