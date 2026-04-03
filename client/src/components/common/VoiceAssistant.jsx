// FILE: client/src/components/common/VoiceAssistant.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVoice from '../../hooks/useVoice';
import { useAccessibility } from '../../context/AccessibilityContext';
import api from '../../services/api';

const SNOOZE_MINUTES = 10;
const CHECKIN_INTERVAL_MS = 2 * 60 * 60 * 1000;
const CHECKIN_QUESTIONS = [
    { time: '08:30', question: 'Good morning. How did you sleep last night?' },
    { time: '13:30', question: 'How are you feeling after lunch? Any pain or discomfort?' },
    { time: '17:00', question: 'How was your afternoon? Did you talk with anyone today?' },
    { time: '20:30', question: 'How are you feeling overall today? Happy, sad, or somewhere in between?' }
];
const CASUAL_CHECKINS = [
    'How are you feeling right now?',
    'Have you had enough water today?',
    'How was your sleep last night?',
    'Is there anything you need help with today?'
];
const DONE_PATTERNS = ['done', 'completed', 'finished', 'took it', 'taken', 'yes', 'already', 'okay', 'had it'];
const LATER_PATTERNS = ['later', 'after', '10 minutes', 'ten minutes', 'remind me', 'not now', 'few minutes', 'wait', 'hold on'];
const NO_PATTERNS = ['cannot', 'cant', 'can not', 'wont', 'will not', 'skip', 'no', 'refuse', 'do not want'];
const EMERGENCY_PATTERNS = ['help', 'pain', 'fell', 'fall', 'hurt', 'chest', 'breathe', 'breathing', 'dizzy', 'emergency', 'doctor', 'hospital', 'ambulance'];
const SAD_PATTERNS = ['sad', 'lonely', 'alone', 'tired', 'bored', 'unhappy', 'bad', 'miss', 'cry', 'upset', 'depressed', 'terrible', 'awful', 'worried', 'anxious'];
const GREETING_PATTERNS = ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon', 'ashraya'];
const TIME_PATTERNS = ['what time', 'the time', 'current time', 'tell me the time'];
const TASK_PATTERNS = ['tasks', 'my tasks', 'pending', 'schedule', 'what do i have'];
const JOKES = [
    'Why did the scarecrow win an award? Because he was outstanding in his field.',
    'What do you call a bear with no teeth? A gummy bear.',
    'Why can a bicycle not stand on its own? Because it is two tired.',
    'What do you call cheese that is not yours? Nacho cheese.'
];
const CHEER_RESPONSES = [
    'You are never alone. I am always right here with you.',
    'You are doing so well. Everyone around you loves you very much.',
    'It is okay to have a hard day. I am here, and tomorrow can be gentler.',
    'You are a strong and wonderful person, and I am proud of you.'
];

const includesAny = (text, patterns) => patterns.some((pattern) => text.includes(pattern));

const normalizeTranscript = (value) => value
    .toLowerCase()
    .replace(/hey guardian/gi, '')
    .replace(/hey ashraya/gi, '')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseTaskTime = (timeString) => {
    const now = new Date();
    const [hours, minutes] = String(timeString || '00:00').split(':').map(Number);
    const date = new Date(now);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const getCheckinKey = (item) => `${getTodayKey()}_${item.time}`;

const getToneScore = (text) => {
    const normalized = normalizeTranscript(text);
    if (!normalized) return 5;
    if (/(happy|good|fine|great|better|okay)/.test(normalized)) return 7;
    if (/(sad|pain|lonely|tired|bad|weak|worried|anxious|confused)/.test(normalized)) return 3;
    return 5;
};

const detectIntent = (text) => {
    if (!text) return 'no_response';
    if (includesAny(text, EMERGENCY_PATTERNS)) return 'emergency';
    if (includesAny(text, DONE_PATTERNS)) return 'done';
    if (includesAny(text, LATER_PATTERNS)) return 'later';
    if (includesAny(text, NO_PATTERNS)) return 'no';
    return 'unknown';
};

const detectMood = (text) => {
    if (!text) return 'unknown';
    if (includesAny(text, SAD_PATTERNS)) return 'sad';
    return 'neutral';
};

/* ── Mic icon SVG ── */
const MicSvg = ({ size = 20, color = 'currentColor' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const VoiceAssistant = ({ onCommand, navMode = false }) => {
    const { settings } = useAccessibility();
    const [open, setOpen] = useState(false);
    const [response, setResponse] = useState('');
    const [history, setHistory] = useState([]);
    const [working, setWorking] = useState(false);
    const [assistantEnabled, setAssistantEnabled] = useState(true);
    const [schedule, setSchedule] = useState(null);
    const [activePrompt, setActivePrompt] = useState(null);
    const [snoozedTasks, setSnoozedTasks] = useState({});
    const [lastReminderAt, setLastReminderAt] = useState({});
    const [completedReportDate, setCompletedReportDate] = useState('');
    const [lastCasualCheckinAt, setLastCasualCheckinAt] = useState(Date.now());

    const reminderLockRef = useRef(false);
    const spokenCheckinsRef = useRef(new Set());
    const activePromptRef = useRef(null);
    const assistantEnabledRef = useRef(true);
    const lastHandledTranscriptRef = useRef('');

    const {
        listening,
        transcript,
        supported,
        error,
        provider,
        startListening,
        stopListening,
        speak,
        resetTranscript
    } = useVoice({
        language: 'en-IN',
        continuous: false
    });

    useEffect(() => {
        activePromptRef.current = activePrompt;
    }, [activePrompt]);

    useEffect(() => {
        assistantEnabledRef.current = assistantEnabled;
    }, [assistantEnabled]);

    const refreshSchedule = useCallback(async () => {
        try {
            const { data } = await api.get('/schedule/today');
            setSchedule(data.schedule || null);
            return data.schedule || null;
        } catch (err) {
            console.error('Schedule fetch failed:', err.message);
            return null;
        }
    }, []);

    const safeSpeak = useCallback(async (message) => {
        setResponse(message);
        if (!settings.hearingImpaired) {
            await speak(message);
        }
    }, [settings.hearingImpaired, speak]);

    const restartListeningSoon = useCallback(() => {
        if (!assistantEnabledRef.current || settings.hearingImpaired) return;
        if (!activePromptRef.current) return;
        window.setTimeout(() => {
            resetTranscript();
            startListening();
        }, 350);
    }, [resetTranscript, settings.hearingImpaired, startListening]);

    const finishInteraction = useCallback(async (userText, assistantText) => {
        setHistory((prev) => [...prev.slice(-5), { user: userText, assistant: assistantText }]);
        setLastCasualCheckinAt(Date.now());
        if (onCommand) {
            onCommand(userText, assistantText);
        }
        await safeSpeak(assistantText);
        restartListeningSoon();
    }, [onCommand, restartListeningSoon, safeSpeak]);

    const summarizeTasksForVoice = useCallback(async () => {
        const currentSchedule = schedule || await refreshSchedule();
        const allTasks = currentSchedule?.tasks || [];
        const pendingTasks = allTasks.filter((task) => task.status === 'pending');
        const doneTasks = allTasks.filter((task) => task.status === 'done');

        if (!pendingTasks.length) {
            return 'All your tasks for today are done. Well done.';
        }

        const names = pendingTasks.slice(0, 3).map((task) => task.title).join(', ');
        return `You have ${doneTasks.length} tasks completed and ${pendingTasks.length} tasks still pending today. Your pending tasks are ${names}.`;
    }, [refreshSchedule, schedule]);

    const requestCompanionReply = useCallback(async (rawTranscript) => {
        const moodSignals = [];
        const normalized = normalizeTranscript(rawTranscript);

        if (detectMood(normalized) === 'sad') {
            moodSignals.push('needs emotional support');
        }

        const { data } = await api.post('/voice/respond', {
            query: rawTranscript,
            moodSignals
        });

        return data.reply || 'I am here with you.';
    }, []);

    const handleTaskDecision = useCallback(async (task, rawTranscript) => {
        const command = normalizeTranscript(rawTranscript);
        const intent = detectIntent(command);
        const mood = detectMood(command);

        if (intent === 'done') {
            await api.put(`/schedule/task/${task.taskId}`, {
                status: 'done',
                notes: 'Completed by voice assistant'
            });
            await refreshSchedule();
            setActivePrompt(null);
            await finishInteraction(rawTranscript, 'Wonderful. I have marked that task as completed. You are doing amazing today.');
            return;
        }

        if (intent === 'later') {
            const snoozeUntil = Date.now() + SNOOZE_MINUTES * 60 * 1000;
            setSnoozedTasks((prev) => ({ ...prev, [task.taskId]: snoozeUntil }));
            setActivePrompt(null);
            await finishInteraction(rawTranscript, `No problem. I will remind you again about ${task.title} in ${SNOOZE_MINUTES} minutes.`);
            return;
        }

        if (intent === 'no') {
            await api.put(`/schedule/task/${task.taskId}`, {
                status: 'refused',
                refusalReason: rawTranscript,
                notes: 'Refused through voice assistant'
            });
            await refreshSchedule();
            setActivePrompt(null);
            await finishInteraction(rawTranscript, `That is okay. I have saved that you could not do ${task.title}.`);
            return;
        }

        if (intent === 'emergency') {
            await api.post('/health/fall-alert', { type: 'manual_sos', confirmedByElder: true });
            setActivePrompt(null);
            await finishInteraction(rawTranscript, 'Oh no. I am alerting your guardian right now. Please stay calm.');
            return;
        }

        if (mood === 'sad') {
            await finishInteraction(rawTranscript, `${CHEER_RESPONSES[Math.floor(Math.random() * CHEER_RESPONSES.length)]} Now please tell me if you completed the task or want more time.`);
            return;
        }

        await finishInteraction(rawTranscript, 'Please say completed if you finished, later if you need more time, or say you cannot do it.');
    }, [finishInteraction, refreshSchedule]);

    const handleCheckinResponse = useCallback(async (question, rawTranscript) => {
        try {
            const { data } = await api.post('/emotion/checkin', {
                question,
                response: rawTranscript,
                voiceToneScore: getToneScore(rawTranscript)
            });
            setActivePrompt(null);

            let reply = 'Thank you for talking with me. I am here with you.';
            const mood = data.analysis?.moodLabel;
            if (mood === 'sad' || mood === 'anxious' || data.analysis?.concernFlag) {
                reply = CHEER_RESPONSES[Math.floor(Math.random() * CHEER_RESPONSES.length)];
            } else if (mood === 'happy') {
                reply = 'That is lovely to hear. I am happy you are feeling good.';
            }

            await finishInteraction(rawTranscript, reply);
        } catch (err) {
            console.error('Checkin save failed:', err.message);
            setActivePrompt(null);
            await finishInteraction(rawTranscript, 'I could not save your check-in right now, but I am still here with you.');
        }
    }, [finishInteraction]);

    const runGeneralCommand = useCallback(async (rawTranscript) => {
        const command = normalizeTranscript(rawTranscript);

        if (!command) {
            await finishInteraction(rawTranscript, 'I did not catch that. Could you say that again?');
            return;
        }

        if (includesAny(command, TIME_PATTERNS)) {
            const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            await finishInteraction(rawTranscript, `The current time is ${t}.`);
            return;
        }

        if (includesAny(command, TASK_PATTERNS) || command.includes('next task') || command.includes('what is next')) {
            await finishInteraction(rawTranscript, await summarizeTasksForVoice());
            return;
        }

        if (command.includes('took my medicine') || command.includes('medicine taken') || command.includes('took the medicine')) {
            const currentSchedule = schedule || await refreshSchedule();
            const medicineTask = currentSchedule?.tasks
                ?.filter((t) => t.type === 'medicine' && t.status === 'pending')
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];
            if (!medicineTask) {
                await finishInteraction(rawTranscript, 'I could not find a pending medicine task right now.');
                return;
            }
            await api.put(`/schedule/task/${medicineTask.taskId}`, { status: 'done', notes: 'Marked done by voice assistant' });
            await refreshSchedule();
            await finishInteraction(rawTranscript, `${medicineTask.title} has been marked as done. Well done!`);
            return;
        }

        if (includesAny(command, EMERGENCY_PATTERNS) && (command.includes('sos') || command.includes('help me') || command.includes('call') || command.includes('emergency') || command.includes('fell'))) {
            await api.post('/health/fall-alert', { type: 'manual_sos', confirmedByElder: true });
            await finishInteraction(rawTranscript, 'I have alerted your guardian right away. Help is on the way. Please stay calm.');
            return;
        }

        const reply = await requestCompanionReply(rawTranscript);
        await finishInteraction(rawTranscript, reply);
    }, [finishInteraction, refreshSchedule, requestCompanionReply, schedule, summarizeTasksForVoice]);


    const handleVoiceResult = useCallback(async (rawTranscript) => {
        setWorking(true);
        try {
            const prompt = activePromptRef.current;
            if (prompt?.type === 'task') {
                await handleTaskDecision(prompt.task, rawTranscript);
            } else if (prompt?.type === 'checkin') {
                await handleCheckinResponse(prompt.question, rawTranscript);
            } else {
                await runGeneralCommand(rawTranscript);
            }
        } catch (err) {
            console.error('Voice assistant flow failed:', err.message);
            await finishInteraction(rawTranscript, 'I could not complete that voice command right now.');
        } finally {
            setWorking(false);
        }
    }, [finishInteraction, handleCheckinResponse, handleTaskDecision, runGeneralCommand]);

    useEffect(() => {
        if (!transcript || transcript === lastHandledTranscriptRef.current) return;
        lastHandledTranscriptRef.current = transcript;
        handleVoiceResult(transcript);
    }, [handleVoiceResult, transcript]);

    const promptTask = useCallback(async (task) => {
        if (reminderLockRef.current) return;
        reminderLockRef.current = true;
        setActivePrompt({ type: 'task', task });
        setLastReminderAt((prev) => ({ ...prev, [task.taskId]: Date.now() }));
        stopListening();
        await safeSpeak(`Hello. It is now time to ${task.title}. Please say completed when you finish, or say later if you need more time.`);
        resetTranscript();
        startListening();
        reminderLockRef.current = false;
    }, [resetTranscript, safeSpeak, startListening, stopListening]);

    const promptCheckin = useCallback(async (question, key) => {
        if (reminderLockRef.current) return;
        reminderLockRef.current = true;
        spokenCheckinsRef.current.add(key);
        setActivePrompt({ type: 'checkin', question, key });
        stopListening();
        await safeSpeak(question);
        resetTranscript();
        startListening();
        reminderLockRef.current = false;
    }, [resetTranscript, safeSpeak, startListening, stopListening]);

    const promptCasualCheckin = useCallback(async () => {
        if (reminderLockRef.current) return;
        reminderLockRef.current = true;
        const question = CASUAL_CHECKINS[Math.floor(Math.random() * CASUAL_CHECKINS.length)];
        setActivePrompt({ type: 'checkin', question, key: `casual_${Date.now()}` });
        stopListening();
        await safeSpeak(question);
        resetTranscript();
        startListening();
        reminderLockRef.current = false;
    }, [resetTranscript, safeSpeak, startListening, stopListening]);

    useEffect(() => {
        if (!open || !assistantEnabled || settings.hearingImpaired) return;
        refreshSchedule();
        return () => {
            stopListening();
        };
    }, [assistantEnabled, open, refreshSchedule, settings.hearingImpaired, stopListening]);

    useEffect(() => {
        if (!open || !assistantEnabled) return;

        const interval = window.setInterval(async () => {
            if (reminderLockRef.current || activePromptRef.current || working) return;

            const currentSchedule = await refreshSchedule();
            const now = Date.now();
            const dueTask = currentSchedule?.tasks
                ?.filter((task) => task.status === 'pending')
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                .find((task) => {
                    const taskTime = parseTaskTime(task.scheduledTime).getTime();
                    const snoozeUntil = snoozedTasks[task.taskId] || 0;
                    const lastReminder = lastReminderAt[task.taskId] || 0;
                    return now >= taskTime && now >= snoozeUntil && now - lastReminder > 60 * 1000;
                });

            if (dueTask) {
                await promptTask(dueTask);
                return;
            }

            const checkin = CHECKIN_QUESTIONS.find((item) => {
                const checkinTime = parseTaskTime(item.time).getTime();
                return now >= checkinTime && now - checkinTime < 10 * 60 * 1000 && !spokenCheckinsRef.current.has(getCheckinKey(item));
            });

            if (checkin) {
                await promptCheckin(checkin.question, getCheckinKey(checkin));
                return;
            }

            if (now - lastCasualCheckinAt >= CHECKIN_INTERVAL_MS) {
                await promptCasualCheckin();
                return;
            }

            const currentDate = getTodayKey();
            const endOfDayTime = parseTaskTime('21:30').getTime();
            if (now >= endOfDayTime && completedReportDate !== currentDate) {
                try {
                    await api.post('/report/generate', {});
                    setCompletedReportDate(currentDate);
                } catch (err) {
                    console.error('Auto report generation failed:', err.message);
                }
            }
        }, 15000);

        return () => window.clearInterval(interval);
    }, [assistantEnabled, completedReportDate, lastCasualCheckinAt, lastReminderAt, open, promptCasualCheckin, promptCheckin, promptTask, refreshSchedule, snoozedTasks, working]);

    useEffect(() => {
        if (open && assistantEnabled && !settings.hearingImpaired) {
            safeSpeak('Hello. I am your Ashraya assistant. I will keep reminding you about your tasks, checking on your mood, and helping you whenever you speak to me.');
        }
    }, [assistantEnabled, open, safeSpeak, settings.hearingImpaired]);

    const quickCommands = useMemo(() => ([
        'What is my next task',
        'I took my medicine',
        'I feel lonely',
        'Tell me a joke',
        'SOS'
    ]), []);

    if (!supported || settings.hearingImpaired) return null;

    /* ── navMode: render as a FAB button in the bottom nav (called from ElderDashboard) ── */
    if (navMode) {
        return (
            <>
                {/* The FAB itself — ElderDashboard places this in its nav */}
                <button
                    id="voice-assistant-fab"
                    onClick={() => { setOpen((v) => !v); if (listening) stopListening(); }}
                    aria-label={open ? 'Close voice assistant' : 'Open voice assistant'}
                    style={{
                        width: 52, height: 52,
                        borderRadius: '50%',
                        background: open
                            ? 'linear-gradient(135deg, #DC2626, #b91c1c)'
                            : listening
                            ? 'linear-gradient(135deg, #DC2626, #b91c1c)'
                            : 'linear-gradient(135deg, var(--teal-deep), var(--teal-mid))',
                        border: 'none',
                        boxShadow: open
                            ? '0 4px 20px rgba(220,38,38,0.5)'
                            : '0 4px 20px rgba(0,89,92,0.4)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.25s, box-shadow 0.25s',
                        position: 'relative',
                    }}
                >
                    {/* Pulse ring when listening */}
                    {listening && (
                        <span style={{
                            position: 'absolute', inset: -4,
                            borderRadius: '50%',
                            border: '2px solid rgba(220,38,38,0.5)',
                            animation: 'live-pulse 1.1s infinite',
                        }} />
                    )}
                    <MicSvg size={22} color="white" />
                </button>

                {/* Panel — pops up above the nav */}
                {open && (
                    <div style={{
                        position: 'fixed',
                        bottom: 80,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 69,
                        width: 'min(calc(100vw - 32px), 380px)',
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Teal header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px',
                            background: 'linear-gradient(135deg, var(--teal-deep), var(--teal-mid))',
                            gap: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 18 }}>🌿</span>
                                <div>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                                        Ashraya Assistant
                                    </p>
                                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                                        {provider === 'browser' ? 'Live voice · Browser' : 'Recorded voice fallback'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { const n = !assistantEnabled; setAssistantEnabled(n); if (!n) stopListening(); }}
                                aria-label="Toggle assistant on/off"
                                style={{
                                    padding: '5px 13px', borderRadius: 'var(--radius-pill)',
                                    fontSize: '0.72rem', fontWeight: 700, border: 0,
                                    background: assistantEnabled ? 'rgba(255,255,255,0.18)' : 'rgba(220,38,38,0.4)',
                                    color: 'white', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                            >
                                {assistantEnabled ? 'On ✓' : 'Off'}
                            </button>
                        </div>

                        {/* Waveform status */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 16px',
                            background: 'var(--bg-muted)',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 22 }}>
                                {[8, 16, 22, 16, 10, 18, 12].map((h, i) => (
                                    <span key={i} style={{
                                        display: 'block', width: 3, borderRadius: 2,
                                        background: listening ? 'var(--teal-deep)' : working ? 'var(--amber-container)' : 'var(--border)',
                                        height: listening ? `${h}px` : '4px',
                                        transition: 'height 0.25s, background 0.25s',
                                        animation: listening ? `wave-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate` : 'none',
                                    }} />
                                ))}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.3 }}>
                                    {listening ? '🔴 Listening…' : working ? '⏳ Thinking…' : '⚪ Standby'}
                                </p>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                    {activePrompt?.type === 'task' ? 'Waiting for task reply'
                                        : activePrompt?.type === 'checkin' ? 'Check-in active'
                                            : 'Ready — tap to speak'}
                                </p>
                            </div>
                        </div>

                        {/* Response bubble */}
                        <div style={{ padding: '10px 14px', minHeight: 56 }}>
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                background: response ? 'var(--teal-light)' : 'var(--bg-muted)',
                                color: response ? 'var(--teal-deep)' : 'var(--text-muted)',
                                fontSize: '0.82rem', lineHeight: 1.55,
                                border: response ? '1px solid rgba(0,109,109,0.15)' : '1px solid var(--border)',
                            }}>
                                {response
                                    ? `🌿 ${response}`
                                    : 'Hello! I am your Ashraya assistant. I will remind you about tasks, check on your mood, and help whenever you speak.'}
                            </div>
                            {transcript ? (
                                <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                                    "{transcript}"
                                </p>
                            ) : null}
                            {error ? (
                                <p style={{ fontSize: '0.74rem', color: 'var(--red)', marginTop: 6 }}>
                                    {error.includes('quota') ? 'Voice quota exceeded — browser fallback active.' : `Mic issue: ${error}`}
                                </p>
                            ) : null}
                        </div>

                        {/* Chat history */}
                        {history.length > 0 ? (
                            <div style={{
                                maxHeight: 110, overflowY: 'auto',
                                padding: '6px 14px 10px',
                                borderTop: '1px solid var(--border)',
                                display: 'flex', flexDirection: 'column', gap: 8,
                            }}>
                                {[...history].reverse().slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{
                                            alignSelf: 'flex-end',
                                            background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)',
                                            padding: '5px 10px', fontSize: '0.73rem', color: 'var(--text-body)',
                                            maxWidth: '86%',
                                        }}>You: {item.user}</div>
                                        <div style={{
                                            alignSelf: 'flex-start',
                                            background: 'var(--teal-light)', borderRadius: 'var(--radius-md)',
                                            padding: '5px 10px', fontSize: '0.73rem', color: 'var(--teal-deep)',
                                            maxWidth: '90%',
                                        }}>🌿 {item.assistant}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {/* Speak button */}
                        <button
                            onClick={() => { if (listening) { stopListening(); } else { resetTranscript(); startListening(); } }}
                            disabled={working || !assistantEnabled}
                            aria-label={listening ? 'Stop listening' : 'Start listening'}
                            style={{
                                height: 50, width: '100%', border: 0, cursor: 'pointer',
                                background: listening ? '#DC2626' : 'var(--teal-deep)',
                                color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                opacity: (working || !assistantEnabled) ? 0.6 : 1,
                                fontFamily: 'inherit', letterSpacing: '0.02em',
                                transition: 'background 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            {working ? '⏳ Working…' : listening ? '🔴 Stop Listening' : '🎙 Tap to Speak Now'}
                        </button>

                        {/* Quick commands */}
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 6,
                            padding: '10px 14px 14px',
                            background: 'var(--bg-cream)',
                            borderTop: '1px solid var(--border)',
                        }}>
                            {quickCommands.map((cmd) => (
                                <button
                                    key={cmd}
                                    onClick={() => handleVoiceResult(cmd)}
                                    aria-label={`Quick command: ${cmd}`}
                                    style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                                        background: 'var(--bg-muted)', color: 'var(--text-body)',
                                        fontSize: '0.73rem', fontWeight: 600,
                                        border: '1px solid var(--border)',
                                        cursor: 'pointer', fontFamily: 'inherit',
                                        transition: 'background 0.15s',
                                    }}
                                >{cmd}</button>
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    }

    /* ── Default (non-navMode): floating pill launcher ── */
    return (
        <>
            {/* Floating Launcher */}
            <button
                id="voice-assistant-launcher"
                onClick={() => { setOpen((v) => !v); if (listening) stopListening(); }}
                aria-label={open ? 'Close voice assistant' : 'Open voice assistant'}
                style={{
                    position: 'fixed', bottom: 28, left: 24, zIndex: 70,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '0 20px', height: settings.mobilityImpaired ? 56 : 46,
                    borderRadius: 'var(--radius-pill)',
                    background: open ? 'var(--teal-deep)' : 'var(--bg-card)',
                    border: open ? '2px solid var(--teal-deep)' : '1.5px solid var(--border)',
                    boxShadow: open ? '0 8px 32px rgba(0,109,109,0.35)' : 'var(--shadow-card)',
                    cursor: 'pointer', color: open ? 'white' : 'var(--text-body)',
                    fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
                    transition: 'background 0.25s, box-shadow 0.25s, color 0.25s',
                    whiteSpace: 'nowrap',
                }}
            >
                <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: listening ? '#DC2626' : working ? 'var(--amber-container)' : open ? 'rgba(255,255,255,0.85)' : 'var(--green)',
                    animation: listening ? 'live-pulse 1.1s infinite' : 'none',
                    transition: 'background 0.3s',
                }} />
                <span>{open ? '✕ Close' : '🎙 Assistant'}</span>
            </button>

            {/* Assistant Panel */}
            {open ? (
                <div style={{
                    position: 'fixed', bottom: 86, left: 16, zIndex: 69,
                    width: 'min(calc(100vw - 32px), 400px)',
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                }}>
                    {/* Teal header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, var(--teal-deep), var(--teal-mid))',
                        gap: 12,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>🌿</span>
                            <div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                                    Ashraya Assistant
                                </p>
                                <p style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                                    {provider === 'browser' ? 'Live voice · Browser' : 'Recorded voice fallback'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { const n = !assistantEnabled; setAssistantEnabled(n); if (!n) stopListening(); }}
                            aria-label="Toggle assistant on/off"
                            style={{
                                padding: '5px 13px', borderRadius: 'var(--radius-pill)',
                                fontSize: '0.72rem', fontWeight: 700, border: 0,
                                background: assistantEnabled ? 'rgba(255,255,255,0.18)' : 'rgba(220,38,38,0.4)',
                                color: 'white', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {assistantEnabled ? 'On ✓' : 'Off'}
                        </button>
                    </div>

                    {/* Waveform status row */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 16px',
                        background: 'var(--bg-muted)',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 22 }}>
                            {[8, 16, 22, 16, 10, 18, 12].map((h, i) => (
                                <span key={i} style={{
                                    display: 'block', width: 3, borderRadius: 2,
                                    background: listening ? 'var(--teal-deep)' : working ? 'var(--amber-container)' : 'var(--border)',
                                    height: listening ? `${h}px` : '4px',
                                    transition: 'height 0.25s, background 0.25s',
                                    animation: listening ? `wave-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate` : 'none',
                                }} />
                            ))}
                        </div>
                        <div>
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.3 }}>
                                {listening ? '🔴 Listening…' : working ? '⏳ Thinking…' : '⚪ Standby'}
                            </p>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                {activePrompt?.type === 'task' ? 'Waiting for task reply'
                                    : activePrompt?.type === 'checkin' ? 'Check-in active'
                                        : 'Ready — tap to speak'}
                            </p>
                        </div>
                    </div>

                    {/* Latest response bubble */}
                    <div style={{ padding: '10px 14px', minHeight: 56 }}>
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: response ? 'var(--teal-light)' : 'var(--bg-muted)',
                            color: response ? 'var(--teal-deep)' : 'var(--text-muted)',
                            fontSize: '0.82rem', lineHeight: 1.55,
                            border: response ? '1px solid rgba(0,109,109,0.15)' : '1px solid var(--border)',
                        }}>
                            {response
                                ? `🌿 ${response}`
                                : 'Hello! I am your Ashraya assistant. I will remind you about tasks, check on your mood, and help whenever you speak.'}
                        </div>
                        {transcript ? (
                            <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                                "{transcript}"
                            </p>
                        ) : null}
                        {error ? (
                            <p style={{ fontSize: '0.74rem', color: 'var(--red)', marginTop: 6 }}>
                                {error.includes('quota') ? 'Voice quota exceeded — browser fallback active.' : `Mic issue: ${error}`}
                            </p>
                        ) : null}
                    </div>

                    {/* Chat history */}
                    {history.length > 0 ? (
                        <div style={{
                            maxHeight: 130, overflowY: 'auto',
                            padding: '6px 14px 10px',
                            borderTop: '1px solid var(--border)',
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            {[...history].reverse().slice(0, 4).map((item, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{
                                        alignSelf: 'flex-end',
                                        background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)',
                                        padding: '5px 10px', fontSize: '0.74rem', color: 'var(--text-body)',
                                        maxWidth: '86%',
                                    }}>You: {item.user}</div>
                                    <div style={{
                                        alignSelf: 'flex-start',
                                        background: 'var(--teal-light)', borderRadius: 'var(--radius-md)',
                                        padding: '5px 10px', fontSize: '0.74rem', color: 'var(--teal-deep)',
                                        maxWidth: '90%',
                                    }}>🌿 {item.assistant}</div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Speak button */}
                    <button
                        onClick={() => { if (listening) { stopListening(); } else { resetTranscript(); startListening(); } }}
                        disabled={working || !assistantEnabled}
                        aria-label={listening ? 'Stop listening' : 'Start listening'}
                        style={{
                            height: 50, width: '100%', border: 0, cursor: 'pointer',
                            background: listening ? '#DC2626' : 'var(--teal-deep)',
                            color: 'white', fontWeight: 700, fontSize: '0.9rem',
                            opacity: (working || !assistantEnabled) ? 0.6 : 1,
                            fontFamily: 'inherit', letterSpacing: '0.02em',
                            transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                    >
                        {working ? '⏳ Working…' : listening ? '🔴 Stop Listening' : '🎙 Tap to Speak Now'}
                    </button>

                    {/* Quick commands */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6,
                        padding: '10px 14px 14px',
                        background: 'var(--bg-cream)',
                        borderTop: '1px solid var(--border)',
                    }}>
                        {quickCommands.map((cmd) => (
                            <button
                                key={cmd}
                                onClick={() => handleVoiceResult(cmd)}
                                aria-label={`Quick command: ${cmd}`}
                                style={{
                                    padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                                    background: 'var(--bg-muted)', color: 'var(--text-body)',
                                    fontSize: '0.74rem', fontWeight: 600,
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'background 0.15s',
                                }}
                            >{cmd}</button>
                        ))}
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default VoiceAssistant;
