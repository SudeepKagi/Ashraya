// FILE: client/src/components/elder/EmotionCheckin.jsx
import { useState, useEffect } from 'react';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';

const CHECKIN_QUESTIONS = {
    '08:30': 'Good morning. How did you sleep last night?',
    '13:30': 'How are you feeling after lunch? Any pain or discomfort?',
    '17:00': 'Did you have any visitors today? How was your afternoon?',
    '20:30': 'How are you feeling overall today? Happy, sad, or somewhere in between?',
    default: 'How are you feeling right now? Tell me in your own words.'
};

const MOOD_OPTIONS = [
    { label: 'Very Happy', symbol: ':)', score: 9 },
    { label: 'Good', symbol: ':]', score: 7 },
    { label: 'Okay', symbol: ':|', score: 5 },
    { label: 'Not Great', symbol: ':(', score: 3 },
    { label: 'Unwell', symbol: '!!', score: 1 }
];

const EmotionCheckin = ({ task, onComplete, onClose }) => {
    const { speak, startListening, stopListening, transcript, supported } = useVoice();

    const now = new Date();
    const timeKey = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const question = Object.entries(CHECKIN_QUESTIONS).reduce((best, [time, value]) => {
        if (time === 'default') return best;
        const diff = Math.abs(parseInt(time, 10) - parseInt(timeKey, 10));
        return diff < best.diff ? { diff, value } : best;
    }, { diff: Infinity, value: CHECKIN_QUESTIONS.default }).value;

    const [phase, setPhase] = useState('question');
    const [typedResponse, setTypedResponse] = useState('');
    const [inputMode, setInputMode] = useState('voice');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => speak(question), 450);
        return () => window.clearTimeout(timer);
    }, [question, speak]);

    useEffect(() => {
        if (transcript && phase === 'listening') {
            stopListening();
            setPhase('submitting');
            submitResponse(transcript);
        }
    }, [phase, stopListening, transcript]);

    const submitResponse = async (text, voiceToneScore = 5) => {
        setError('');
        try {
            const { data } = await api.post('/emotion/checkin', {
                question,
                response: text,
                voiceToneScore
            });
            setResult(data);
            await api.put(`/schedule/task/${task.taskId}`, { status: 'done' });
            const moodLabel = data.analysis?.moodLabel;
            if (moodLabel === 'happy') {
                speak('That is lovely to hear. Keep smiling.');
            } else if (moodLabel === 'sad' || moodLabel === 'anxious') {
                speak('I am sorry you are feeling that way. I am here with you.');
            } else {
                speak('Thank you for sharing. I am here with you.');
            }
            setPhase('result');
        } catch (err) {
            console.error('Checkin submit failed:', err);
            setError('Could not save your response. Please try again.');
            setPhase('question');
        }
    };

    const startVoiceResponse = () => {
        setPhase('listening');
        speak('I am listening. Please speak now.');
        startListening();
    };

    const submitTyped = () => {
        if (!typedResponse.trim()) return;
        setPhase('submitting');
        submitResponse(typedResponse);
    };

    const submitMoodPick = (mood) => {
        setPhase('submitting');
        submitResponse(`I feel ${mood.label}.`, mood.score);
    };

    const getMoodTone = (label) => {
        if (label === 'happy') return 'status-normal';
        if (label === 'sad' || label === 'anxious') return 'status-critical';
        return 'status-warning';
    };

    return (
        <div className="emotion-modal-shell">
            <div className="emotion-modal">
                <div className="emotion-modal-header">
                    <div>
                        <p className="eyebrow">Emotional Wellbeing</p>
                        <h2 className="section-title mt-2">Daily Check-in</h2>
                        <p className="section-subtitle mt-2">A calm check-in to understand how the elder is feeling today.</p>
                    </div>
                    <button onClick={onClose} className="header-icon-button" aria-label="Close emotion check-in">×</button>
                </div>
                <div className="emotion-modal-body">
                    <div className="emotion-stage max-w-3xl mx-auto">
                        {(phase === 'question' || phase === 'listening') ? (
                            <>
                                <p className="metric-label">Question</p>
                                <h3 className="text-2xl font-semibold text-white mt-3 leading-relaxed">{question}</h3>
                                <div className="range-tabs mt-6">
                                    {['voice', 'type', 'quick'].map((mode) => (
                                        <button key={mode} onClick={() => setInputMode(mode)} className={`range-pill ${inputMode === mode ? 'active' : ''}`} aria-pressed={inputMode === mode}>
                                            {mode === 'voice' ? 'Voice' : mode === 'type' ? 'Type' : 'Quick Mood'}
                                        </button>
                                    ))}
                                </div>
                                {inputMode === 'voice' ? (
                                    <div className="medicine-progress-card mt-6 text-center">
                                        <p className="text-sm text-white">Speak your answer naturally. Ashraya will listen and save the response.</p>
                                        <button onClick={phase === 'listening' ? () => { stopListening(); setPhase('question'); } : startVoiceResponse} disabled={!supported} className={`assistant-listen-button mt-5 ${phase === 'listening' ? 'listening' : ''}`} aria-label={phase === 'listening' ? 'Stop voice response' : 'Respond by voice'}>
                                            {phase === 'listening' ? 'Listening...' : 'Respond by Voice'}
                                        </button>
                                        {!supported ? <p className="text-xs muted-text mt-3">Voice input is not supported in this browser.</p> : null}
                                    </div>
                                ) : null}
                                {inputMode === 'type' ? (
                                    <div className="medicine-progress-card mt-6">
                                        <textarea value={typedResponse} onChange={(event) => setTypedResponse(event.target.value)} placeholder="Type how you are feeling..." rows={4} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none resize-none" aria-label="Type your emotional response" />
                                        <div className="medicine-actions"><button onClick={submitTyped} disabled={!typedResponse.trim()} className="header-pill-button" aria-label="Submit typed emotional response">Submit Response</button></div>
                                    </div>
                                ) : null}
                                {inputMode === 'quick' ? (
                                    <div className="medicine-list mt-6">
                                        {MOOD_OPTIONS.map((mood) => (
                                            <button key={mood.label} onClick={() => submitMoodPick(mood)} className="medicine-list-item text-left" aria-label={`Select mood ${mood.label}`}>
                                                <div className="flex items-center gap-3"><span className="text-lg font-semibold text-white">{mood.symbol}</span><span className="text-sm font-semibold text-white">{mood.label}</span></div>
                                                <span className="text-xs muted-text">Score {mood.score}/10</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                                {error ? <p className="critical-text text-sm mt-5">{error}</p> : null}
                            </>
                        ) : null}
                        {phase === 'submitting' ? (
                            <div className="medicine-progress-card text-center">
                                <div className="w-14 h-14 mx-auto rounded-full border-4 border-[var(--accent-teal)] border-t-transparent animate-spin" />
                                <p className="text-white font-semibold mt-5">Analysing the response...</p>
                                <p className="text-sm muted-text mt-2">Saving emotional check-in and updating the daily wellbeing score.</p>
                            </div>
                        ) : null}
                        {phase === 'result' && result ? (
                            <>
                                <p className="metric-label">Analysis</p>
                                <div className={`medicine-result-card mt-5 ${result.analysis?.concernFlag ? 'danger' : 'success'}`}>
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div><p className="text-lg font-semibold text-white capitalize">{result.analysis?.moodLabel || 'Noted'}</p><p className="text-sm muted-text mt-2">{result.analysis?.summary || 'Your response has been saved for today.'}</p></div>
                                        <span className={`status-badge ${getMoodTone(result.analysis?.moodLabel)}`}><span className="status-dot" />{result.analysis?.concernFlag ? 'Attention' : 'Saved'}</span>
                                    </div>
                                    <div className="medicine-progress-card mt-5">
                                        <div className="flex items-center justify-between gap-3"><span className="text-sm text-white">Mood score today</span><span className="text-sm text-white">{result.dailyMoodScore?.toFixed(1)} / 10</span></div>
                                        <div className="progress-bar mt-3"><div className="progress-bar-fill" style={{ width: `${((result.dailyMoodScore || 0) / 10) * 100}%` }} /></div>
                                    </div>
                                    {result.analysis?.emotions?.length ? <div className="assistant-quick-grid mt-5">{result.analysis.emotions.map((emotion) => <span key={emotion} className="assistant-quick-pill">{emotion}</span>)}</div> : null}
                                </div>
                                <div className="medicine-actions"><button onClick={() => { onComplete?.(); onClose(); }} className="header-pill-button" aria-label="Close emotional check-in">Done</button></div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmotionCheckin;