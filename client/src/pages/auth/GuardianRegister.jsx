// FILE: client/src/pages/auth/GuardianRegister.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const GuardianRegister = () => {
    const { registerGuardian, loading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', elderPhone: '' });

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
        <div className="auth-shell">
            <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
                <section className="summary-shell p-8 lg:p-10">
                    <p className="eyebrow">Guardian Console</p>
                    <h1 className="section-title mt-3 text-[2.3rem] leading-tight">Stay connected to your loved one with live health, mood, and safety visibility.</h1>
                    <p className="section-subtitle mt-4 max-w-2xl">Receive fall alerts, medicine warnings, emotional health insights, and daily AI summaries in one streamlined guardian dashboard.</p>

                    <div className="auth-feature-stack mt-8">
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">L</div><span className="status-badge status-normal"><span className="status-dot" />Live</span></div>
                            <h3 className="text-lg font-semibold text-white">Vitals Monitoring</h3>
                            <p className="section-subtitle mt-2">Continuous updates from connected elder devices, medication routines, and safety events.</p>
                        </article>
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">R</div><span className="status-badge status-warning"><span className="status-dot" />Review</span></div>
                            <h3 className="text-lg font-semibold text-white">AI Reports</h3>
                            <p className="section-subtitle mt-2">Actionable summaries, recommendations, and emotional wellbeing trends in one place.</p>
                        </article>
                    </div>
                </section>

                <section className="glass-panel p-8 lg:p-10 self-center">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="sidebar-brand-mark w-14 h-14 text-xl">G</div>
                        <div>
                            <p className="eyebrow">Create Account</p>
                            <h2 className="section-title mt-1">Register as Guardian</h2>
                        </div>
                    </div>

                    {error ? (
                        <div className="glass-panel p-4 mb-5 text-sm critical-text" role="alert">{error}</div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input name="name" required placeholder="Your full name" value={form.name} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" aria-label="Full name" />
                        <input name="phone" required placeholder="Your phone number" value={form.phone} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" aria-label="Phone number" />
                        <input name="email" type="email" required placeholder="Your email" value={form.email} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" aria-label="Email address" />
                        <input name="password" type="password" required minLength={6} placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" aria-label="Password" />
                        <div className="glass-panel p-4">
                            <label className="metric-label block mb-2">Link to Elder (optional)</label>
                            <input name="elderPhone" placeholder="Elder's phone number" value={form.elderPhone} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" aria-label="Elder's phone number" />
                            <p className="text-xs muted-text mt-2">If the elder is already registered, enter their phone number to connect accounts.</p>
                        </div>
                        <button type="submit" disabled={loading} className="header-pill-button w-full justify-center" aria-label="Create guardian account">
                            {loading ? 'Creating...' : 'Create Guardian Account'}
                        </button>
                    </form>

                    <p className="text-sm muted-text mt-6">
                        Already have an account? <Link to="/login" className="text-[var(--accent-teal)]">Sign In</Link>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default GuardianRegister;
