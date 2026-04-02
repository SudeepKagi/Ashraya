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
const HOW_ARE_YOU_PATTERNS = ['how are you', 'are you okay', 'you good', 'you fine'];
const JOKE_PATTERNS = ['joke', 'funny', 'laugh', 'make me laugh'];
const TASK_PATTERNS = ['tasks', 'my tasks', 'pending', 'schedule', 'what do i have'];
const COMPLIMENT_PATTERNS = ['good job', 'great', 'excellent', 'wonderful', 'nice', 'love you', 'thank you', 'thanks', 'well done'];
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

const VoiceAssistant = ({ onCommand }) => {
    const { settings } = useAccessibility();
    const [open, setOpen] = useState(true);
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
        const mood = detectMood(command);

        if (!command) {
            await finishInteraction(rawTranscript, 'I did not catch that. Please try again.');
            return;
        }

        if (includesAny(command, GREETING_PATTERNS)) {
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
            await finishInteraction(rawTranscript, `${greeting}. I am right here with you. How can I help you?`);
            return;
        }

        if (includesAny(command, TIME_PATTERNS)) {
            await finishInteraction(rawTranscript, `The current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
            return;
        }

        if (includesAny(command, HOW_ARE_YOU_PATTERNS)) {
            await finishInteraction(rawTranscript, 'I am doing great, thank you for asking. I am here with you.');
            return;
        }

        if (includesAny(command, JOKE_PATTERNS)) {
            await finishInteraction(rawTranscript, JOKES[Math.floor(Math.random() * JOKES.length)]);
            return;
        }

        if (includesAny(command, TASK_PATTERNS) || command.includes('next task')) {
            await finishInteraction(rawTranscript, await summarizeTasksForVoice());
            return;
        }

        if (includesAny(command, COMPLIMENT_PATTERNS)) {
            await finishInteraction(rawTranscript, 'Thank you so much. I am always here for you.');
            return;
        }

        if (command.includes('what is next')) {
            const currentSchedule = schedule || await refreshSchedule();
            const nextTask = currentSchedule?.tasks
                ?.filter((task) => task.status === 'pending')
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

            if (!nextTask) {
                await finishInteraction(rawTranscript, 'You have completed all your tasks for today. Well done.');
                return;
            }

            await finishInteraction(rawTranscript, `Your next task is ${nextTask.title} at ${nextTask.scheduledTime}.`);
            return;
        }

        if (command.includes('took my medicine') || command.includes('medicine taken') || command.includes('took the medicine')) {
            const currentSchedule = schedule || await refreshSchedule();
            const medicineTask = currentSchedule?.tasks
                ?.filter((task) => task.type === 'medicine' && task.status === 'pending')
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

            if (!medicineTask) {
                await finishInteraction(rawTranscript, 'I could not find a pending medicine task right now.');
                return;
            }

            await api.put(`/schedule/task/${medicineTask.taskId}`, { status: 'done', notes: 'Marked done by voice assistant' });
            await refreshSchedule();
            await finishInteraction(rawTranscript, `${medicineTask.title} has been marked as done.`);
            return;
        }

        if (
            command.includes('tablet') && (command.includes('over') || command.includes('finished') || command.includes('got over') || command.includes('out')) ||
            command.includes('medicine is over') ||
            command.includes('medicines are over') ||
            command.includes('medicine got over') ||
            command.includes('out of medicine')
        ) {
            await api.post('/health/guardian-alert', {
                category: 'medicine_supply',
                message: 'Medicine supply is running low or finished. Please refill the tablets soon.'
            });
            await finishInteraction(rawTranscript, 'I have sent a medicine refill alert to your guardian.');
            return;
        }

        if (includesAny(command, EMERGENCY_PATTERNS) || command.includes('not feeling well') || command.includes('i need help') || command.includes('sos') || command.includes('call guardian')) {
            await api.post('/health/fall-alert', { type: 'manual_sos', confirmedByElder: true });
            await finishInteraction(rawTranscript, 'I have alerted your guardian right away. Help is on the way.');
            return;
        }

        if (mood === 'sad') {
            await finishInteraction(rawTranscript, CHEER_RESPONSES[Math.floor(Math.random() * CHEER_RESPONSES.length)]);
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

    return (
        <>
            <button
                onClick={() => {
                    setOpen((value) => !value);
                    if (listening) {
                        stopListening();
                    }
                }}
                aria-label="Open voice assistant"
                className={`assistant-launcher ${open ? 'open' : ''} ${settings.mobilityImpaired ? 'large' : ''}`}
            >
                <span className="assistant-launcher-orb" />
                <span className="assistant-launcher-label">{open ? 'Close Assistant' : 'Open Assistant'}</span>
            </button>

            {open ? (
                <div className={`assistant-panel ${settings.audioOnly ? 'audio-mode' : ''}`}>
                    <div className="assistant-panel-header">
                        <div>
                            <p className="text-sm font-semibold text-white">Ashraya Assistant</p>
                            <p className="text-xs muted-text">
                                {provider === 'browser'
                                    ? 'Voice reminders, mood check-ins, and spoken help'
                                    : provider === 'server'
                                        ? 'Voice reminders with recorded fallback'
                                        : 'Spoken reminders, check-ins, and voice help'}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                const nextValue = !assistantEnabled;
                                setAssistantEnabled(nextValue);
                                if (!nextValue) {
                                    stopListening();
                                }
                            }}
                            className={`assistant-state-pill ${assistantEnabled ? 'on' : 'off'}`}
                            aria-label="Toggle always listening assistant"
                        >
                            {assistantEnabled ? 'Assistant On' : 'Assistant Off'}
                        </button>
                    </div>

                    <div className="assistant-status-panel">
                        <div className="assistant-status-row">
                            <span className={`status-badge ${listening ? 'status-normal' : working ? 'status-warning' : 'status-critical'}`}>
                                <span className="status-dot" />
                                {listening ? 'Listening' : working ? 'Thinking' : 'Standby'}
                            </span>
                            <span className="chart-tooltip text-xs">{activePrompt?.type === 'task' ? 'Task reply pending' : activePrompt?.type === 'checkin' ? 'Check-in pending' : 'Ready for conversation'}</span>
                        </div>
                        <p className="assistant-latest-copy">
                            {response || 'I am ready to remind, listen, and speak back.'}
                        </p>
                    </div>

                    <div className="assistant-history">
                        {activePrompt?.type === 'task' ? (
                            <p className="assistant-info assistant-warning">
                                Waiting for task response: say completed, later, or cannot do it.
                            </p>
                        ) : null}
                        {activePrompt?.type === 'checkin' ? (
                            <p className="assistant-info assistant-soft">
                                Waiting for check-in response.
                            </p>
                        ) : null}
                        {history.map((item, index) => (
                            <div key={index} className="assistant-message-stack">
                                <p className="assistant-bubble user">You: {item.user}</p>
                                <p className="assistant-bubble assistant">Assistant: {item.assistant}</p>
                            </div>
                        ))}
                        <p className="assistant-info assistant-neutral">
                            Spoken reminders stay automatic. Tap anytime to ask for help, your next task, or emotional support.
                        </p>
                        {error ? (
                            <p className="text-xs critical-text">
                                {error.includes('quota')
                                    ? 'Voice fallback is out of quota. Browser speech listening should still work for live commands.'
                                    : error.includes('Failed to transcribe audio')
                                        ? 'Recorded voice fallback failed. Check that the backend is running and the API key is set.'
                                        : `Mic error: ${error}`}
                            </p>
                        ) : null}
                    </div>

                    <button
                        onClick={() => {
                            if (listening) {
                                stopListening();
                            } else {
                                resetTranscript();
                                startListening();
                            }
                        }}
                        aria-label={listening ? 'Stop listening' : 'Start listening'}
                        className={`assistant-listen-button ${listening ? 'listening' : ''}`}
                        disabled={working || !assistantEnabled}
                    >
                        {working ? 'Working...' : listening ? 'Listening...' : 'Tap to listen now'}
                    </button>

                    {transcript ? (
                        <p className="assistant-transcript">"{transcript}"</p>
                    ) : null}

                    <div className="assistant-quick-grid">
                        {quickCommands.map((command) => (
                            <button
                                key={command}
                                onClick={() => handleVoiceResult(command)}
                                className="assistant-quick-pill"
                                aria-label={`Quick command: ${command}`}
                            >
                                {command}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default VoiceAssistant;
