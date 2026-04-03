// FILE: client/src/pages/elder/ElderDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import TaskCard from '../../components/elder/TaskCard';
import FallDetector from '../../components/elder/FallDetector';
import VoiceAssistant from '../../components/common/VoiceAssistant';
import useVoice from '../../hooks/useVoice';
import useNotifications from '../../hooks/useNotifications';
import { useAccessibility } from '../../context/AccessibilityContext';

/* ── Inline SVG Icons ── */
const Ico = ({ d, fill, size = 22 }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    <path d={d} />
  </svg>
);
const HomeIcon   = () => <Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
const TaskIcon   = () => <Ico d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />;
const UserIcon   = () => <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
const HeartIcon  = () => <Ico d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill />;
const ActivityIcon = () => <Ico d="M4 13h4l2-5 4 10 2-5h4" />;
const ShieldIcon = () => <Ico d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />;
const LogoutIcon = () => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
const MicIcon    = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

/* ── Helpers ── */
const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const getDate = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const getNow  = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
};

/* ── Task type → icon emoji ── */
const taskEmoji = (type) => ({
  medicine: '💊', exercise: '🧘', meal: '🍽️', water: '💧', checkin: '💬', bp_report: '🩺'
}[type] || '📋');

/* ── Task type → Stitch colour style ── */
const taskCardStyle = (task) => {
  if (task.status === 'done') return {
    background: 'var(--bg-muted)', border: 'none', opacity: 0.75
  };
  if (task.status === 'pending') {
    const isPrimary = ['medicine', 'exercise'].includes(task.type);
    if (isPrimary) return {
      background: 'linear-gradient(135deg, #ffad3e, #f59e0b)',
      border: 'none', color: '#432900',
    };
  }
  return { background: 'var(--bg-card)', border: '1px solid var(--border)', };
};

/* ── Vital Pill ── */
const VitalPill = ({ icon, value, unit, label, color }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '12px 8px',
    background: 'var(--bg-card)', borderRadius: 16,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: color || 'var(--text-heading)', lineHeight: 1 }}>
      {value}
    </span>
    {unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{unit}</span>}
    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{label}</span>
  </div>
);

/* ── Task Row (Stitch style) ── */
const TaskRow = ({ task, onUpdate, prescribedMedicines }) => {
  const isActive = task.status === 'pending' && ['medicine','exercise'].includes(task.type);
  const isDone   = task.status === 'done';

  if (isActive) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #ffad3e 0%, #f59e0b 100%)',
        borderRadius: 20, padding: '16px 20px', marginBottom: 10,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 8, right: 12 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px',
            background: 'rgba(255,255,255,0.3)', borderRadius: 999,
            color: '#432900', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>NEXT UP · {task.scheduledTime}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>{taskEmoji(task.type)}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2b1700', lineHeight: 1.2 }}>{task.title}</p>
            <p style={{ fontSize: '0.8rem', color: '#6e3a00', marginTop: 4, lineHeight: 1.4 }}>
              {task.instructions?.slice(0, 80)}
            </p>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>›</div>
        </div>
        <TaskCard task={task} onUpdate={onUpdate} prescribedMedicines={prescribedMedicines} inlineOnly />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 16, padding: '14px 16px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: isDone ? 0.6 : 1,
      borderLeft: isDone ? '3px solid var(--teal-deep)' : '3px solid transparent',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: isDone ? 'var(--teal-light)' : 'var(--bg-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{isDone ? '✅' : taskEmoji(task.type)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)',
          textDecoration: isDone ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.title}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{task.scheduledTime}</p>
      </div>
      <span style={{
        fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999,
        background: isDone ? 'rgba(0,89,92,0.12)' : 'var(--bg-muted)',
        color: isDone ? 'var(--teal-deep)' : 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
      }}>{isDone ? 'DONE' : task.status === 'refused' ? 'SKIP' : 'PENDING'}</span>
    </div>
  );
};

/* ── Bottom Nav definition ── */
const NAV = [
  { key: 'home',   label: 'Home',     icon: <HomeIcon /> },
  { key: 'tasks',  label: 'My Tasks', icon: <TaskIcon /> },
  { key: 'health', label: 'Health',   icon: <HeartIcon /> },
  { key: 'profile',label: 'Profile',  icon: <UserIcon /> },
];

/* ════════════════════════════════════════════════════════ */
const ElderDashboard = () => {
  const { user, logout } = useAuth();
  const { speak }        = useVoice();
  const { requestPermission, showNotification } = useNotifications();
  const { settings }     = useAccessibility();

  const [schedule, setSchedule]       = useState(null);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeTab, setActiveTab]     = useState('home');
  const [currentTime, setCurrentTime] = useState(getNow());
  const [elderProfile, setElderProfile] = useState(null);
  const [liveWatchVitals, setLiveWatchVitals] = useState({
    hr: null, spo2: null, bp: null, battery: null, source: 'idle',
  });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(getNow()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { requestPermission(); }, [requestPermission]);

  const fetchSchedule = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/schedule/today');
      setSchedule(data.schedule); setStats(data.stats);
      const p = await api.get('/elder/profile');
      setElderProfile(p.data.elder);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load schedule');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  useEffect(() => {
    if (!loading && schedule && user && !settings.hearingImpaired) {
      const pending = schedule.tasks.filter(t => t.status === 'pending');
      speak(`${getGreeting()}, ${user.name}! You have ${pending.length} tasks today.`);
    }
  }, [loading, schedule, user, settings.hearingImpaired, speak]);

  const handleTaskUpdate = (updated, newStats) => {
    setSchedule(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.taskId === updated.taskId ? updated : t),
    }));
    if (newStats) setStats(newStats);
    if (updated.status === 'done') showNotification('Task Done', `${updated.title} completed!`);
  };

  const completionRate = stats?.completionRate || 0;
  const pendingCount   = stats?.pending || 0;
  const firstName      = user?.name?.split(' ')[0] || 'friend';

  const allTasks = schedule?.tasks || [];
  const nextActiveTask = allTasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

  const filteredTasks = allTasks.filter(t => {
    if (activeFilter === 'all')     return true;
    if (activeFilter === 'pending') return t.status === 'pending';
    if (activeFilter === 'done')    return t.status === 'done';
    return t.type === activeFilter;
  }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const moodLabel = completionRate >= 75 ? '😊 Steady' : completionRate >= 45 ? '😐 Support' : '😔 Watch';

  /* ── Shell styles ── */
  const shell = {
    minHeight: '100vh',
    background: 'var(--bg-cream)',
    display: 'flex', flexDirection: 'column',
    maxWidth: 480, margin: '0 auto',
    position: 'relative',
  };

  return (
    <div className={`elder-shell ${settings.largeText ? 'large-text' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}
      style={shell}>

      {/* ── Top greeting card (Stitch: avatar + greeting + sun icon) ── */}
      <div style={{
        background: 'var(--bg-warm)',
        padding: '16px 20px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--teal-mid)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.1rem', flexShrink: 0,
            }}>
              {firstName[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {getGreeting()},
              </p>
              <h1 style={{
                fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)',
                fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1,
              }}>
                {firstName}
              </h1>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>{getDate()}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: 'var(--amber-container)' }}><SunIcon /></div>
            <button onClick={logout} style={{
              background: 'none', border: 0, cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
            }} aria-label="Logout">
              <LogoutIcon />
            </button>
          </div>
        </div>

        {/* ── Vitals Pills Row ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <VitalPill
            icon="❤️"
            value={liveWatchVitals.hr ?? (activeTab === 'health' ? '--' : stats?.done ?? '72')}
            unit="bpm"
            label="BPM"
            color="#c0392b"
          />
          <VitalPill
            icon="🫁"
            value={liveWatchVitals.spo2 ?? '98'}
            unit="%"
            label="SpO₂"
            color="#0d7377"
          />
          <VitalPill
            icon="📊"
            value={`${completionRate}%`}
            label="Progress"
            color="var(--teal-deep)"
          />
        </div>

        {/* ── Daily Progress Bar ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Daily Progress
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {stats?.done || 0}/{stats?.total || 0}
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 999,
            background: 'var(--bg-muted)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${completionRate}%`,
              background: 'linear-gradient(90deg, var(--teal-deep), var(--teal-mid))',
              borderRadius: 999, transition: 'width 0.6s var(--ease-out)',
            }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
            {completionRate >= 75
              ? `You're doing great, ${firstName}! Halfway through. 🎉`
              : completionRate >= 45
              ? `Good progress! ${pendingCount} tasks remaining.`
              : `Let's get started, ${firstName}! 💪`}
          </p>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <main style={{ flex: 1, padding: '0 16px 100px', overflowY: 'auto' }}>
        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 12, borderRadius: 12,
            background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.85rem',
          }}>
            {error} <button onClick={fetchSchedule} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--red)', textDecoration: 'underline', marginLeft: 6 }}>Retry</button>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {activeTab === 'home' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>Your Schedule</h2>
              <button onClick={() => setActiveTab('tasks')} style={{
                background: 'none', border: 0, cursor: 'pointer', color: 'var(--teal-deep)',
                fontSize: '0.8rem', fontWeight: 700,
              }}>View All</button>
            </div>

            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ height: 70, borderRadius: 16, background: 'var(--bg-muted)', marginBottom: 8, animation: 'pulse-bg 1.5s infinite' }} />
              ))
            ) : !schedule ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No schedule for today.
              </div>
            ) : (
              <>
                {/* Active/Next task — shown first in orange Stitch style */}
                {nextActiveTask && (
                  <TaskCard
                    task={nextActiveTask}
                    onUpdate={handleTaskUpdate}
                    prescribedMedicines={elderProfile?.profile?.medicines || []}
                    large
                  />
                )}

                {/* Remaining tasks */}
                {allTasks
                  .filter(t => t.taskId !== nextActiveTask?.taskId)
                  .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                  .slice(0, 5)
                  .map(task => (
                    <TaskRow
                      key={task.taskId}
                      task={task}
                      onUpdate={handleTaskUpdate}
                      prescribedMedicines={elderProfile?.profile?.medicines || []}
                    />
                  ))}

                {allTasks.length === 0 && (
                  <div style={{
                    padding: '24px', textAlign: 'center',
                    background: 'var(--bg-card)', borderRadius: 20,
                  }}>
                    <p style={{ fontSize: '1.4rem', marginBottom: 8 }}>🎉</p>
                    <p style={{ fontWeight: 700, color: 'var(--text-heading)' }}>All done for today!</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>You're doing wonderfully.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>Your Schedule</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
                Medicines, exercise, meals, and check-ins.
              </p>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {['all','pending','done','medicine','exercise','meal','water'].map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700,
                  background: activeFilter === f ? 'var(--teal-mid)' : 'var(--bg-muted)',
                  color: activeFilter === f ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ height: 70, borderRadius: 16, background: 'var(--bg-muted)', marginBottom: 8, animation: 'pulse-bg 1.5s infinite' }} />
              ))
            ) : (
              filteredTasks.map(task => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  onUpdate={handleTaskUpdate}
                  prescribedMedicines={elderProfile?.profile?.medicines || []}
                />
              ))
            )}
            {filteredTasks.length === 0 && !loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: '0.9rem' }}>
                No tasks in this category.
              </p>
            )}
          </div>
        )}

        {/* ── HEALTH TAB ── */}
        {activeTab === 'health' && (
          <div>
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>Health Overview</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { icon: '❤️', label: 'Heart Rate', value: liveWatchVitals.hr ?? '--', unit: 'bpm' },
                { icon: '🫁', label: 'SpO₂', value: liveWatchVitals.spo2 ?? '--', unit: '%' },
                { icon: '📊', label: 'Completion', value: `${completionRate}%`, unit: '' },
                { icon: '🔋', label: 'Battery', value: liveWatchVitals.battery ?? '--', unit: '%' },
              ].map(v => (
                <div key={v.label} style={{
                  background: 'var(--bg-card)', borderRadius: 20, padding: '18px 16px',
                  boxShadow: 'var(--shadow-card)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{v.icon}</div>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    {v.value}<span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>{v.unit}</span>
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{v.label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '20px', boxShadow: 'var(--shadow-card)' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--teal-deep)', marginBottom: 8 }}>
                Safety Monitoring
              </p>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 12 }}>
                Watch & Fall Detection
              </h3>
              <FallDetector
                hearingImpaired={Boolean(settings.hearingImpaired || elderProfile?.accessibility?.hearingImpaired)}
                onVitalsUpdate={setLiveWatchVitals}
              />
            </div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div>
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>My Profile</h2>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-card)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--teal-mid)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.4rem',
                }}>
                  {firstName[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)' }}>{user?.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(0,89,92,0.12)', color: 'var(--teal-deep)',
                    fontSize: '0.72rem', fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-deep)', display: 'inline-block' }} />
                    Elder
                  </span>
                </div>
              </div>

              {elderProfile?.profile?.age && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Age', value: `${elderProfile.profile.age} yrs` },
                    { label: 'Blood Group', value: elderProfile.profile.bloodGroup || 'N/A' },
                    { label: 'Medicines', value: elderProfile.profile.medicines?.length || 0 },
                    { label: 'Care Plan', value: 'Active' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'var(--bg-warm)', borderRadius: 14, padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: 4 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={logout} style={{
              width: '100%', height: 52,
              background: 'var(--bg-muted)', border: 0, borderRadius: 'var(--radius-pill)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)',
            }}>
              <LogoutIcon /> Sign out
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Navigation (Stitch: Home · Mic-Centre · Profile) ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 16px 12px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        zIndex: 40,
      }} aria-label="Main navigation">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === 'home' ? 'var(--teal-deep)' : 'var(--text-muted)',
            fontWeight: activeTab === 'home' ? 700 : 500,
            fontSize: '0.7rem', padding: '4px 12px',
          }}
          aria-label="Home" aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <HomeIcon />
          Home
        </button>

        {/* My Tasks */}
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === 'tasks' ? 'var(--teal-deep)' : 'var(--text-muted)',
            fontWeight: activeTab === 'tasks' ? 700 : 500,
            fontSize: '0.7rem', padding: '4px 12px',
          }}
          aria-label="My Tasks" aria-current={activeTab === 'tasks' ? 'page' : undefined}
        >
          <TaskIcon />
          My Tasks
        </button>

        {/* Centre mic FAB — opens Voice Assistant */}
        <div style={{ position: 'relative', marginTop: -18 }}>
          <VoiceAssistant navMode />
        </div>

        {/* Health */}
        <button
          onClick={() => setActiveTab('health')}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === 'health' ? 'var(--teal-deep)' : 'var(--text-muted)',
            fontWeight: activeTab === 'health' ? 700 : 500,
            fontSize: '0.7rem', padding: '4px 12px',
          }}
          aria-label="Health" aria-current={activeTab === 'health' ? 'page' : undefined}
        >
          <HeartIcon />
          Health
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === 'profile' ? 'var(--teal-deep)' : 'var(--text-muted)',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '0.7rem', padding: '4px 12px',
          }}
          aria-label="Profile" aria-current={activeTab === 'profile' ? 'page' : undefined}
        >
          <UserIcon />
          Profile
        </button>
      </nav>
    </div>
  );
};

export default ElderDashboard;
