// FILE: client/src/hooks/useVoice.js
import { useState, useEffect, useRef, useCallback } from 'react';

const useVoice = ({ onResult, language = 'en-IN', continuous = false } = {}) => {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [supported, setSupported] = useState(false);
    const recognitionRef = useRef(null);
    const synthRef = useRef(window.speechSynthesis);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { setSupported(false); return; }

        setSupported(true);
        const recognition = new SpeechRecognition();
        recognition.lang = language;
        recognition.continuous = continuous;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1][0].transcript.trim();
            setTranscript(result);
            if (onResult) onResult(result);
        };

        recognition.onend = () => setListening(false);
        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            setListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [language, continuous]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || listening) return;
        setTranscript('');
        recognitionRef.current.start();
        setListening(true);
    }, [listening]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setListening(false);
    }, []);

    /**
     * Speak text aloud via Web Speech Synthesis
     * @param {string} text
     * @param {object} options — { rate, pitch, volume }
     */
    const speak = useCallback((text, options = {}) => {
        if (!synthRef.current) return;
        synthRef.current.cancel(); // stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = options.rate || 0.9;    // slightly slower for elderly
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;
        synthRef.current.speak(utterance);
    }, [language]);

    const stopSpeaking = useCallback(() => {
        synthRef.current?.cancel();
    }, []);

    return { listening, transcript, supported, startListening, stopListening, speak, stopSpeaking };
};

export default useVoice;