// FILE: client/src/components/elder/EmotionCheckin.jsx
import { useState, useEffect } from 'react';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';

const CHECKIN_QUESTIONS = {
    '08:30': 'Good morning! How did you sleep last night?',
    '13:30': 'How are you feeling after lunch? Any pain or discomfort?',
    '17:00': 'Did you have any visitors today? How was your afternoon?',
    '20:30': 'How are you feeling overall today? Happy, sad, or somewhere in between?',
    default: 'How are you feeling right now? Tell me in your own words.'
};

const MOOD_OPTIONS = [
    { label: 'Very Happy', emoji: '😄', value: 'happy', score: 9 },
    { label: 'Good', emoji: '🙂', value: 'neutral', score: 7 },
    { label: 'Okay', emoji: '😐', value: 'neutral', score: 5 },
    { label: 'Not Great', emoji: '😔', value: 'sad', score: 3 },
    { label: 'Unwell', emoji: '😟', value: 'anxious', score: 1 }
];

const EmotionCheckin = ({ task, onComplete, onClose }) => {
    const { speak, startListening, stopListening, listening, transcript, supported } = useVoice();

    const now = new Date();
    const timeKey = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Find the closest question
    const question = Object.entries(CHECKIN_QUESTIONS).reduce((best, [t, q]) => {
        if (t === 'default') return best;
        const diff = Math.abs(parseInt(t) - parseInt(timeKey));
        return diff < best.diff ? { diff, q } : best;
    }, { diff: Infinity, q: CHECKIN_QUESTIONS.default }).q;

    const [phase, setPhase] = useState('question'); // question | listening | typing | submitting | result
    const [response, setResponse] = useState('');
    const [typedResponse, setTypedResponse] = useState('');
    const [inputMode, setInputMode] = useState('voice'); // voice | type
    const [result, setResult] = useState(null);
    const [quickMood, setQuickMood] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // Read the question aloud when component mounts
        setTimeout(() => speak(question), 500);
    }, []);

    // When transcript comes in from voice, use it
    useEffect(() => {
        if (transcript && phase === 'listening') {
            setResponse(transcript);
            stopListening();
            setPhase('submitting');
            submitResponse(transcript);
        }
    }, [transcript]);

    const startVoiceResponse = () => {
        setPhase('listening');
        startListening();
        speak('I am listening. Please speak now.');
    };

    const submitTyped = () => {
        if (!typedResponse.trim()) return;
        setResponse(typedResponse);
        setPhase('submitting');
        submitResponse(typedResponse);
    };

    const submitMoodPick = async (mood) => {
        setQuickMood(mood);
        const text = `I feel ${mood.label}. ${mood.label === 'Very Happy' ? 'Having a great day!' : mood.label === 'Unwell' ? 'Not feeling well today.' : ''}`;
        setResponse(text);
        setPhase('submitting');
        await submitResponse(text, mood.score);
    };

    const submitResponse = async (text, voiceScore = 5) => {
        setError('');
        try {
            const { data } = await api.post('/emotion/checkin', {
                question,
                response: text,
                voiceToneScore: voiceScore
            });
            setResult(data);

            const { moodLabel } = data.analysis || {};
            if (moodLabel === 'happy') speak('That is wonderful to hear! Keep smiling.');
            else if (moodLabel === 'sad' || moodLabel === 'anxious') speak('I am sorry you are feeling that way. Your guardian has been notified.');
            else speak('Thank you for sharing. Have a good day!');

            setPhase('result');

            // Mark task done
            await api.put(`/schedule/task/${task.taskId}`, { status: 'done' });
        } catch (err) {
            console.error('Checkin submit failed:', err);
            setError('Could not save your response. Please try again.');
            setPhase('question');
        }
    };

    const getMoodColor = (label) => {
        const map = { happy: 'text-emerald-400', neutral: 'text-blue-400', sad: 'text-orange-400', anxious: 'text-red-400', confused: 'text-purple-400' };
        return map[label] || 'text-gray-300';
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-950 to-purple-950 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-sm">💬</div>
                    <p className="text-white font-semibold text-sm">Emotion Check-in</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-sm" aria-label="Close check-in">✕</button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto w-full">

                {/* Question phase */}
                {(phase === 'question' || phase === 'listening') && (
                    <>
                        <div className="w-20 h-20 bg-pink-900 bg-opacity-50 rounded-full flex items-center justify-center text-4xl mb-6">
                            {phase === 'listening' ? '🎤' : '💬'}
                        </div>

                        <p className="text-white text-xl font-semibold leading-relaxed mb-8">{question}</p>

                        {/* Input mode toggle */}
                        <div className="flex bg-white bg-opacity-10 rounded-full p-1 mb-6">
                            {['voice', 'type', 'quick'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setInputMode(mode)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${inputMode === mode ? 'bg-white text-indigo-900' : 'text-white'}`}
                                    aria-pressed={inputMode === mode}
                                >
                                    {mode === 'voice' ? '🎙️ Voice' : mode === 'type' ? '⌨️ Type' : '😊 Quick'}
                                </button>
                            ))}
                        </div>

                        {/* Voice mode */}
                        {inputMode === 'voice' && (
                            <div className="w-full">
                                {phase === 'listening' ? (
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                            <span className="text-white text-2xl">🎤</span>
                                        </div>
                                        <p className="text-red-300 font-semibold mb-4">Listening... speak now</p>
                                        <button onClick={() => { stopListening(); setPhase('question'); }} className="text-gray-400 text-sm hover:text-white">
                                            Stop listening
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={startVoiceResponse}
                                        disabled={!supported}
                                        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 transition-colors"
                                        aria-label="Respond by voice"
                                    >
                                        🎙️ Speak Your Response
                                    </button>
                                )}
                                {!supported && <p className="text-yellow-400 text-xs mt-2">Voice not supported in this browser.</p>}
                            </div>
                        )}

                        {/* Type mode */}
                        {inputMode === 'type' && (
                            <div className="w-full space-y-3">
                                <textarea
                                    value={typedResponse}
                                    onChange={e => setTypedResponse(e.target.value)}
                                    placeholder="Type how you're feeling..."
                                    rows={3}
                                    className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-4 py-3 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
                                    aria-label="Type your response"
                                />
                                <button
                                    onClick={submitTyped}
                                    disabled={!typedResponse.trim()}
                                    className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-2xl disabled:opacity-50 transition-colors"
                                    aria-label="Submit typed response"
                                >
                                    Submit →
                                </button>
                            </div>
                        )}

                        {/* Quick pick mode */}
                        {inputMode === 'quick' && (
                            <div className="w-full grid grid-cols-1 gap-2">
                                {MOOD_OPTIONS.map(mood => (
                                    <button
                                        key={mood.value + mood.label}
                                        onClick={() => submitMoodPick(mood)}
                                        className="flex items-center gap-4 bg-white bg-opacity-10 hover:bg-opacity-20 border border-white border-opacity-10 rounded-2xl px-5 py-3 transition-colors text-left"
                                        aria-label={`Select mood: ${mood.label}`}
                                    >
                                        <span className="text-3xl">{mood.emoji}</span>
                                        <span className="text-white font-medium">{mood.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                    </>
                )}

                {/* Submitting */}
                {phase === 'submitting' && (
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white font-semibold">Analysing your response...</p>
                        <p className="text-gray-400 text-sm mt-2">AI is checking how you feel</p>
                    </div>
                )}

                {/* Result */}
                {phase === 'result' && result && (
                    <div className="w-full text-center">
                        <div className="text-6xl mb-4">
                            {result.analysis?.moodLabel === 'happy' ? '😊' :
                                result.analysis?.moodLabel === 'sad' ? '😔' :
                                    result.analysis?.moodLabel === 'anxious' ? '😟' : '🙂'}
                        </div>

                        <p className={`text-2xl font-bold mb-2 capitalize ${getMoodColor(result.analysis?.moodLabel)}`}>
                            {result.analysis?.moodLabel || 'Noted'}
                        </p>

                        {result.analysis?.summary && (
                            <p className="text-gray-300 text-sm mb-4 italic">"{result.analysis.summary}"</p>
                        )}

                        <div className="bg-white bg-opacity-10 rounded-2xl p-4 mb-4 text-left">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Mood score today</span>
                                <span className="text-white font-bold">{result.dailyMoodScore?.toFixed(1)} / 10</span>
                            </div>
                            <div className="w-full bg-white bg-opacity-10 rounded-full h-2">
                                <div
                                    className="bg-pink-400 h-2 rounded-full"
                                    style={{ width: `${(result.dailyMoodScore / 10) * 100}%` }}
                                />
                            </div>
                        </div>

                        {result.analysis?.concernFlag && (
                            <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-xl p-3 mb-4 text-sm text-red-300">
                                ⚠️ Your guardian has been notified about your response.
                            </div>
                        )}

                        {result.analysis?.emotions?.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center mb-6">
                                {result.analysis.emotions.map(e => (
                                    <span key={e} className="text-xs bg-white bg-opacity-10 text-gray-300 px-3 py-1 rounded-full">{e}</span>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => { onComplete?.(); onClose(); }}
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-2xl transition-colors"
                            aria-label="Close check-in"
                        >
                            Done ✓
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmotionCheckin;