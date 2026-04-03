// FILE: client/src/pages/auth/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 28, height: 28 }}>
    <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z" opacity="0.15" />
    <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const Login = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState('elder');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      const data = await login(form.email, form.password);
      navigate(data.user.role === 'elder' ? '/elder' : '/guardian');
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const displayError = error || localError;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        borderRadius: 28,
        boxShadow: 'var(--shadow-ambient)',
        overflow: 'hidden',
      }}>
        {/* ── Brand Header ── */}
        <div style={{
          background: 'var(--bg-warm)',
          padding: '36px 28px 28px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Shield logo */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--teal-mid)',
            color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: 'var(--shadow-teal)',
          }}>
            <ShieldIcon />
          </div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--text-heading)', marginBottom: 6,
          }}>
            Ashraya
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Your daily companion for health<br />and happiness
          </p>
        </div>

        {/* ── Form Panel ── */}
        <div style={{ padding: '28px 28px 32px' }}>
          {/* Role toggle */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 28,
            background: 'var(--bg-muted)',
            borderRadius: 'var(--radius-pill)',
            padding: 4,
          }}>
            {[
              { key: 'elder', label: 'Login as Elder' },
              { key: 'guardian', label: 'Login as Guardian' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                id={`role-${r.key}`}
                onClick={() => setActiveRole(r.key)}
                style={{
                  flex: 1, height: 40,
                  borderRadius: 'var(--radius-pill)',
                  border: 0, cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 700,
                  background: activeRole === r.key ? 'var(--teal-mid)' : 'transparent',
                  color: activeRole === r.key ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s var(--ease-out)',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {displayError && (
            <div style={{
              padding: '12px 16px', marginBottom: 20,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--red-light)',
              fontSize: '0.85rem', color: 'var(--red)',
              fontWeight: 500,
            }} role="alert">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Email field */}
            <div>
              <label htmlFor="login-email" style={{
                display: 'block', marginBottom: 8,
                fontFamily: "'Noto Serif', serif",
                fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--text-heading)',
              }}>
                Full Name or Phone
              </label>
              <input
                id="login-email" name="email" type="email"
                required autoComplete="email"
                value={form.email} onChange={handleChange}
                placeholder="Enter your details"
                style={{
                  width: '100%', height: 56,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-warm)',
                  fontSize: '0.95rem',
                  color: 'var(--text-heading)',
                  outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--teal-mid)'; e.target.style.background = 'rgba(157, 240, 244, 0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-warm)'; }}
              />
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="login-password" style={{
                display: 'block', marginBottom: 8,
                fontFamily: "'Noto Serif', serif",
                fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--text-heading)',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  required autoComplete="current-password"
                  value={form.password} onChange={handleChange}
                  placeholder="Enter your password"
                  style={{
                    width: '100%', height: 56,
                    padding: '0 48px 0 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border)',
                    background: 'var(--bg-warm)',
                    fontSize: '0.95rem',
                    color: 'var(--text-heading)',
                    outline: 'none',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--teal-mid)'; e.target.style.background = 'rgba(157, 240, 244, 0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-warm)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 0, cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              style={{
                width: '100%', height: 56,
                background: 'linear-gradient(135deg, var(--teal-deep), var(--teal-mid))',
                color: 'white',
                border: 0, borderRadius: 'var(--radius-pill)',
                fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: '0.02em',
                boxShadow: 'var(--shadow-teal)',
                transition: 'opacity 0.2s, transform 0.15s',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          {/* Forgot password */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" style={{
              background: 'none', border: 0, cursor: 'pointer',
              color: 'var(--teal-mid)', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'underline',
            }}>
              Forgot password?
            </button>
          </div>

          {/* Register links */}
          <div style={{
            marginTop: 24, paddingTop: 20,
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              New to Ashraya?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/register/elder" style={{
                flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-muted)', borderRadius: 'var(--radius-pill)',
                textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                color: 'var(--text-heading)',
                transition: 'background 0.2s',
              }}>
                Register as Elder
              </Link>
              <Link to="/register/guardian" style={{
                flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-muted)', borderRadius: 'var(--radius-pill)',
                textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                color: 'var(--text-heading)',
                transition: 'background 0.2s',
              }}>
                Register as Guardian
              </Link>
            </div>
          </div>

          {/* Trust badge */}
          <div style={{
            marginTop: 24, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Secure Digital Sanctuary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
