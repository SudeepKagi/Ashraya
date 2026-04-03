// FILE: client/src/components/elder/EmotionCheckin.jsx
import { useState, useEffect } from 'react';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';

const CHECKIN_QUESTIONS = {
    '08:30': 'Good morning! How did you sleep last night?',
    '13:30': 'How are you feeling after lunch? Any pain or discomfort?',
    '17:00': 'How was your afternoon? Did you talk with anyone today?',
    '20:30': 'How are you feeling overall today? Happy, sad, or somewhere in between?',
    default: 'How are you feeling right now? Tell me in your own words.',
};

const MOOD_OPTIONS = [
    { label: 'Very Happy', emoji: '😊', score: 9, color: '#059669', bg: '#D1FAE5' },
    { label: 'Good',       emoji: '🙂', score: 7, color: '#0891B2', bg: '#E0F2FE' },
    { label: 'Okay',       emoji: '😐', score: 5, color: '#D97706', bg: '#FEF3C7' },
    { label: 'Not Great',  emoji: '😔', score: 3, color: '#EA580C', bg: '#FFEDD5' },
    { label: 'Unwell',     emoji: '😢', score: 1, color: '#DC2626', bg: '#FEE2E2' },
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
    const [inputMode, setInputMode] = useState('quick');
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
                voiceToneScore,
            });

            setResult(data);
            await api.put(`/schedule/task/${task.taskId}`, { status: 'done' });

            const moodLabel = data.analysis?.moodLabel;
            if (moodLabel === 'happy') speak('That is lovely to hear. Keep smiling!');
            else if (moodLabel === 'sad' || moodLabel === 'anxious') speak('I am sorry you are feeling that way. I am here with you.');
            else speak('Thank you for sharing. I am always here with you.');

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

    const closeAndComplete = () => {
        if (onComplete) onComplete();
        onClose();
    };

    // Styles
    const overlay = {
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
    };
    const modal = {
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden',
    };
    const pill = (active) => ({
        padding: '6px 16px',
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--teal-deep)' : 'var(--bg-muted)',
        color: active ? 'white' : 'var(--text-body)',
        fontWeight: 600, fontSize: '0.82rem',
        border: active ? '0' : '1px solid var(--border)',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.2s, color 0.2s',
    });

    return (
        <div style={overlay}>
            <div style={modal}>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'var(--teal-deep)',
                }}>
                    <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Emotional Wellbeing
                        </p>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, color: 'white', marginTop: 3 }}>
                            Daily Check-in
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close check-in"
                        style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.15)',
                            border: 0, cursor: 'pointer',
                            color: 'white', fontSize: '1.1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px' }}>

                    {(phase === 'question' || phase === 'listening') && (
                        <>
                            {/* Question */}
                            <div style={{
                                padding: '16px 18px',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--teal-light)',
                                border: '1px solid rgba(0,109,109,0.15)',
                                marginBottom: 18,
                            }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-deep)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                                    Question
                                </p>
                                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.55 }}>
                                    {question}
                                </p>
                            </div>

                            {/* Mode switcher */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                {['quick', 'voice', 'type'].map((mode) => (
                                    <button key={mode} style={pill(inputMode === mode)} onClick={() => setInputMode(mode)}>
                                        {mode === 'quick' ? '😊 Quick Mood' : mode === 'voice' ? '🎙 Voice' : '✏️ Type'}
                                    </button>
                                ))}
                            </div>

                            {/* Quick mood picker */}
                            {inputMode === 'quick' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {MOOD_OPTIONS.map((mood) => (
                                        <button
                                            key={mood.label}
                                            onClick={() => submitMoodPick(mood)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 14,
                                                padding: '14px 16px',
                                                borderRadius: 'var(--radius-md)',
                                                background: mood.bg,
                                                border: `1.5px solid ${mood.color}30`,
                                                cursor: 'pointer', textAlign: 'left',
                                                transition: 'transform 0.15s, box-shadow 0.15s',
                                                fontFamily: 'inherit',
                                            }}
                                            aria-label={`Select mood: ${mood.label}`}
                                        >
                                            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{mood.emoji}</span>
                                            <div>
                                                <p style={{ fontSize: '0.92rem', fontWeight: 700, color: mood.color }}>{mood.label}</p>
                                                <p style={{ fontSize: '0.72rem', color: mood.color, opacity: 0.75, marginTop: 2 }}>Score {mood.score}/10</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Voice input */}
                            {inputMode === 'voice' && (
                                <div style={{
                                    padding: 20, borderRadius: 'var(--radius-lg)',
                                    background: 'var(--bg-muted)',
                                    border: '1px solid var(--border)',
                                    textAlign: 'center',
                                }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                        Speak naturally. Ashraya will listen and understand your feelings.
                                    </p>
                                    <button
                                        onClick={phase === 'listening' ? () => { stopListening(); setPhase('question'); } : startVoiceResponse}
                                        disabled={!supported}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            width: '100%', height: 52,
                                            borderRadius: 'var(--radius-md)',
                                            background: phase === 'listening' ? '#DC2626' : 'var(--teal-deep)',
                                            color: 'white', fontWeight: 700, fontSize: '0.92rem',
                                            border: 0, cursor: 'pointer', fontFamily: 'inherit',
                                            animation: phase === 'listening' ? 'pulse-ring 1.5s infinite' : 'none',
                                        }}
                                        aria-label={phase === 'listening' ? 'Stop listening' : 'Start voice response'}
                                    >
                                        {phase === 'listening' ? '🔴 Listening… tap to stop' : '🎙 Respond by Voice'}
                                    </button>
                                    {!supported && (
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
                                            Voice input is not supported in this browser.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Type input */}
                            {inputMode === 'type' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <textarea
                                        value={typedResponse}
                                        onChange={(e) => setTypedResponse(e.target.value)}
                                        placeholder="Type how you are feeling right now…"
                                        rows={4}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1.5px solid var(--border)',
                                            background: 'var(--bg-muted)',
                                            color: 'var(--text-heading)',
                                            fontSize: '0.9rem', lineHeight: 1.6, resize: 'none',
                                            outline: 'none', fontFamily: 'inherit',
                                            boxSizing: 'border-box',
                                        }}
                                        aria-label="Type your emotional response"
                                    />
                                    <button
                                        onClick={submitTyped}
                                        disabled={!typedResponse.trim()}
                                        style={{
                                            height: 48,
                                            borderRadius: 'var(--radius-md)',
                                            background: typedResponse.trim() ? 'var(--teal-deep)' : 'var(--border)',
                                            color: typedResponse.trim() ? 'white' : 'var(--text-muted)',
                                            fontWeight: 700, fontSize: '0.9rem',
                                            border: 0, cursor: typedResponse.trim() ? 'pointer' : 'not-allowed',
                                            fontFamily: 'inherit', transition: 'background 0.2s',
                                        }}
                                        aria-label="Submit typed response"
                                    >
                                        Submit Response
                                    </button>
                                </div>
                            )}

                            {error && (
                                <p style={{ fontSize: '0.82rem', color: 'var(--red)', marginTop: 14, textAlign: 'center' }}>
                                    {error}
                                </p>
                            )}
                        </>
                    )}

                    {/* Submitting */}
                    {phase === 'submitting' && (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <div style={{
                                width: 52, height: 52, margin: '0 auto 20px',
                                borderRadius: '50%',
                                border: '4px solid var(--teal-light)',
                                borderTopColor: 'var(--teal-deep)',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>
                                Analysing your response…
                            </p>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                Saving your emotional wellbeing score for today.
                            </p>
                        </div>
                    )}

                    {/* Result */}
                    {phase === 'result' && result && (() => {
                        const mood = MOOD_OPTIONS.find((m) => m.score >= (result.dailyMoodScore || 5)) || MOOD_OPTIONS[2];
                        return (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                                    <span style={{ fontSize: '3.5rem' }}>{mood.emoji}</span>
                                    <h3 style={{
                                        fontFamily: "'Playfair Display', serif",
                                        fontSize: '1.4rem', fontWeight: 700,
                                        color: 'var(--text-heading)', marginTop: 8, textTransform: 'capitalize',
                                    }}>
                                        {result.analysis?.moodLabel || 'Noted'}
                                    </h3>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                                        {result.analysis?.summary || 'Your response has been saved for today.'}
                                    </p>
                                </div>

                                {/* Mood score bar */}
                                <div style={{
                                    padding: '14px 18px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-muted)',
                                    border: '1px solid var(--border)',
                                    marginBottom: 14,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)' }}>Mood Score Today</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal-deep)' }}>
                                            {result.dailyMoodScore?.toFixed(1)} / 10
                                        </span>
                                    </div>
                                    <div style={{ height: 10, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 6,
                                            background: 'var(--teal-deep)',
                                            width: `${((result.dailyMoodScore || 0) / 10) * 100}%`,
                                            transition: 'width 0.8s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Detected emotions */}
                                {result.analysis?.emotions?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                        {result.analysis.emotions.map((emotion) => (
                                            <span key={emotion} style={{
                                                padding: '4px 12px',
                                                borderRadius: 'var(--radius-pill)',
                                                background: 'var(--teal-light)',
                                                color: 'var(--teal-deep)',
                                                fontSize: '0.76rem', fontWeight: 600,
                                            }}>{emotion}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Concern alert */}
                                {result.analysis?.concernFlag && (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--red-light)', border: '1px solid var(--red)',
                                        marginBottom: 14, fontSize: '0.84rem', color: 'var(--red)',
                                        fontWeight: 600,
                                    }}>
                                        ⚠️ Your guardian will be notified about this check-in.
                                    </div>
                                )}

                                <button
                                    onClick={closeAndComplete}
                                    style={{
                                        width: '100%', height: 48,
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--teal-deep)', color: 'white',
                                        fontWeight: 700, fontSize: '0.92rem',
                                        border: 0, cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                    aria-label="Close emotional check-in"
                                >
                                    ✓ Done — Close
                                </button>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default EmotionCheckin;
