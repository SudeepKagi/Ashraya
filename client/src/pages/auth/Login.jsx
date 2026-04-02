// FILE: client/src/pages/auth/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
    const { login, loading, error } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [localError, setLocalError] = useState('');

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

    return (
        <div className="auth-shell">
            <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-stretch">
                <section className="summary-shell p-8 lg:p-10">
                    <p className="eyebrow">Medical Companion</p>
                    <h1 className="section-title mt-3 text-[2.4rem] leading-tight">A calmer, safer daily care experience for elders and guardians.</h1>
                    <p className="section-subtitle mt-4 max-w-2xl">Ashraya combines live reminders, voice companionship, medicine adherence, safety monitoring, and guardian visibility in one continuous care interface.</p>

                    <div className="auth-feature-stack mt-8">
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">A</div><span className="status-badge status-normal"><span className="status-dot" />Active</span></div>
                            <h3 className="text-lg font-semibold text-white">Voice Companion</h3>
                            <p className="section-subtitle mt-2">Gentle spoken reminders, emotional support, and task follow-up through the day.</p>
                        </article>
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">M</div><span className="status-badge status-warning"><span className="status-dot" />Watch</span></div>
                            <h3 className="text-lg font-semibold text-white">Medicine Safety</h3>
                            <p className="section-subtitle mt-2">Medication prompts, refill escalation, and caregiver awareness in one workflow.</p>
                        </article>
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">G</div><span className="status-badge status-normal"><span className="status-dot" />Live</span></div>
                            <h3 className="text-lg font-semibold text-white">Guardian Feed</h3>
                            <p className="section-subtitle mt-2">Real-time alerts, health summaries, and AI reports for confident family support.</p>
                        </article>
                    </div>
                </section>

                <section className="glass-panel p-8 lg:p-10 self-center">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="sidebar-brand-mark w-14 h-14 text-xl">A</div>
                        <div>
                            <p className="eyebrow">Welcome Back</p>
                            <h2 className="section-title mt-1">Sign in to Ashraya</h2>
                        </div>
                    </div>

                    {(error || localError) ? (
                        <div className="glass-panel p-4 mb-5 text-sm critical-text" role="alert">
                            {error || localError}
                        </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="metric-label block mb-2">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                                placeholder="you@email.com"
                                aria-label="Email address"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="metric-label block mb-2">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                                placeholder="Enter your password"
                                aria-label="Password"
                            />
                        </div>

                        <button type="submit" disabled={loading} className="header-pill-button w-full justify-center" aria-label="Sign in">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 text-sm muted-text space-y-3">
                        <p>Choose a role to get started:</p>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/register/elder" className="range-pill active">Register as Elder</Link>
                            <Link to="/register/guardian" className="range-pill">Register as Guardian</Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Login;
