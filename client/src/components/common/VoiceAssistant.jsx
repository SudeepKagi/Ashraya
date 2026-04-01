// FILE: client/src/components/common/VoiceAssistant.jsx
import { useState, useEffect } from 'react';
import useVoice from '../../hooks/useVoice';

const COMMANDS = {
    'next task': 'What would you like to know about your next task?',
    'i took my medicine': 'Great! I\'ll mark your medicine as taken.',
    'i\'m not feeling well': 'I\'m sorry to hear that. Should I alert your guardian?',
    'sos': 'Sending SOS alert now.',
    'what time': `The time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
};

const VoiceAssistant = ({ onCommand }) => {
    const [open, setOpen] = useState(false);
    const [response, setResponse] = useState('');
    const [history, setHistory] = useState([]);

    const handleResult = (transcript) => {
        const lower = transcript.toLowerCase();
        let reply = "I heard you say: \"" + transcript + "\". I'm still learning that command!";

        for (const [key, val] of Object.entries(COMMANDS)) {
            if (lower.includes(key)) { reply = val; break; }
        }

        setResponse(reply);
        setHistory(prev => [...prev.slice(-4), { user: transcript, assistant: reply }]);
        speak(reply);
        if (onCommand) onCommand(transcript, reply);
    };

    const { listening, transcript, supported, startListening, stopListening, speak } = useVoice({
        onResult: handleResult,
        language: 'en-IN'
    });

    useEffect(() => {
        if (open) speak('Hello! I\'m your Ashraya assistant. How can I help you?');
    }, [open]);

    if (!supported) return null;

    return (
        <>
            {/* Floating mic button */}
            <button
                onClick={() => setOpen(!open)}
                aria-label="Open voice assistant"
                className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all
          ${open ? 'bg-indigo-600 scale-110' : 'bg-white border-2 border-indigo-200 hover:border-indigo-400'}`}
            >
                <span className="text-xl">{open ? '✕' : '🎙️'}</span>
            </button>

            {/* Assistant panel */}
            {open && (
                <div className="fixed bottom-24 left-6 z-50 bg-white rounded-2xl shadow-xl border border-gray-200 w-72 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-sm">🤖</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Ashraya Assistant</p>
                            <p className="text-xs text-gray-400">Say "Hey Guardian" or tap mic</p>
                        </div>
                    </div>

                    {/* Conversation history */}
                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                        {history.map((h, i) => (
                            <div key={i} className="space-y-1">
                                <p className="text-xs bg-gray-100 rounded-lg px-2 py-1 text-gray-700">You: {h.user}</p>
                                <p className="text-xs bg-indigo-50 rounded-lg px-2 py-1 text-indigo-700">Assistant: {h.assistant}</p>
                            </div>
                        ))}
                    </div>

                    {/* Mic button */}
                    <button
                        onClick={listening ? stopListening : startListening}
                        aria-label={listening ? 'Stop listening' : 'Start listening'}
                        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors
              ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                        {listening ? '🔴 Listening...' : '🎙️ Tap to speak'}
                    </button>

                    {transcript && (
                        <p className="text-xs text-gray-400 mt-2 text-center italic">"{transcript}"</p>
                    )}

                    {/* Quick commands */}
                    <div className="mt-3 flex flex-wrap gap-1">
                        {['Next task', 'Took medicine', 'Not feeling well'].map(cmd => (
                            <button
                                key={cmd}
                                onClick={() => handleResult(cmd.toLowerCase())}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-full transition-colors"
                                aria-label={`Quick command: ${cmd}`}
                            >
                                {cmd}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceAssistant;