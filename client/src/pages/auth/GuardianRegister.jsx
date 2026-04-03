// FILE: client/src/pages/auth/GuardianRegister.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const inp = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--border)',
  background: 'var(--bg-muted)',
  color: 'var(--text-heading)',
  fontSize: '0.93rem',
  outline: 'none',
  fontFamily: 'inherit',
};

const GuardianRegister = () => {
  const { registerGuardian, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', elderPhone: '',
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await registerGuardian(form);
      navigate('/guardian');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top left, rgba(0,109,109,0.07), transparent 55%), radial-gradient(ellipse at bottom right, rgba(245,158,11,0.06), transparent 55%), var(--bg-cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 920,
        display: 'grid',
        gridTemplateColumns: 'clamp(260px, 45%, 420px) 1fr',
        gap: 24, alignItems: 'stretch',
      }} className="auth-grid">

        {/* ── Left: info panel ── */}
        <aside style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: '36px 28px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 'var(--radius-md)',
              background: 'var(--teal-deep)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700,
            }}>A</div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Ashraya
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--teal-deep)', fontWeight: 600 }}>Guardian Console</p>
            </div>
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.3rem, 3vw, 1.6rem)',
            fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.35, marginBottom: 12,
          }}>
            Stay connected to your loved one — live.
          </h2>

          <p style={{ fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
            Receive fall alerts, medicine warnings, emotional health insights, and daily AI summaries in one streamlined guardian dashboard.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '📡', title: 'Live Vitals',     desc: 'Continuous updates from elder devices and medication routines.' },
              { icon: '🔔', title: 'Instant Alerts',  desc: 'Fall detection, SOS, and anomaly alerts sent directly to you.' },
              { icon: '📊', title: 'AI Daily Report', desc: 'Actionable summaries and wellbeing trends every evening.' },
            ].map((f) => (
              <div key={f.title} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>{f.title}</p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--teal-deep)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </aside>

        {/* ── Right: form ── */}
        <section style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: '36px 28px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ marginBottom: 28 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Create Account</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Register as Guardian
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
              Connect to your elder's care network instantly.
            </p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.87rem' }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input style={inp} name="name" required placeholder="Your full name" value={form.name} onChange={handleChange} aria-label="Full name" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Phone Number</label>
              <input style={inp} name="phone" required placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} aria-label="Phone number" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input style={inp} name="email" type="email" required placeholder="you@email.com" value={form.email} onChange={handleChange} aria-label="Email address" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
              <input style={inp} name="password" type="password" required minLength={6} placeholder="At least 6 characters" value={form.password} onChange={handleChange} aria-label="Password" />
            </div>

            <div style={{
              marginTop: 4, padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--teal-light)',
              border: '1px solid rgba(0,109,109,0.18)',
            }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-deep)', display: 'block', marginBottom: 8 }}>
                🔗 Link to Elder (optional)
              </label>
              <input style={{ ...inp, background: 'white' }} name="elderPhone" placeholder="Elder's registered phone number" value={form.elderPhone} onChange={handleChange} aria-label="Elder's phone number" />
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                If the elder is already registered, enter their phone to connect accounts immediately.
              </p>
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop: 8, width: '100%', height: 52,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--teal-deep)', color: 'white',
              fontWeight: 700, fontSize: '0.95rem', border: 0, cursor: 'pointer',
              boxShadow: 'var(--shadow-teal)',
              opacity: loading ? 0.7 : 1,
            }} aria-label="Create guardian account">
              {loading ? 'Creating account…' : 'Create Guardian Account →'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default GuardianRegister;
