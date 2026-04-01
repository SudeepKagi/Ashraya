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

    const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-indigo-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <span className="text-white text-xl font-bold">G</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">Register as Guardian</h1>
                    <p className="text-gray-500 text-sm mt-1">Monitor and care for your loved one</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm" role="alert">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="name" required placeholder="Your Full Name" value={form.name} onChange={handleChange} className={inputClass} aria-label="Full name" />
                    <input name="phone" required placeholder="Your Phone Number" value={form.phone} onChange={handleChange} className={inputClass} aria-label="Phone number" />
                    <input name="email" type="email" required placeholder="Your Email" value={form.email} onChange={handleChange} className={inputClass} aria-label="Email address" />
                    <input name="password" type="password" required minLength={6} placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} className={inputClass} aria-label="Password" />

                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Link to Elder (optional)</label>
                        <input name="elderPhone" placeholder="Elder's Phone Number" value={form.elderPhone} onChange={handleChange} className={inputClass} aria-label="Elder's phone number" />
                        <p className="text-xs text-gray-400 mt-1">If the elder is already registered, enter their phone to link accounts.</p>
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
                        aria-label="Create guardian account"
                    >
                        {loading ? 'Creating...' : 'Create Guardian Account'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account? <Link to="/login" className="text-emerald-600 font-medium hover:underline">Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default GuardianRegister;