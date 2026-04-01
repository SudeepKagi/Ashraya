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
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-emerald-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-white text-2xl font-bold">A</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Ashraya</h1>
                    <p className="text-gray-500 text-sm mt-1">AI-Driven Elderly Care</p>
                </div>

                <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">Welcome back</h2>

                {(error || localError) && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm" role="alert">
                        {error || localError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={form.email}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="you@email.com"
                            aria-label="Email address"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={form.password}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="••••••••"
                            aria-label="Password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
                        aria-label="Sign in"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center space-y-2 text-sm text-gray-600">
                    <p>New here?</p>
                    <div className="flex gap-3 justify-center">
                        <Link to="/register/elder" className="text-indigo-600 font-medium hover:underline">Register as Elder</Link>
                        <span className="text-gray-400">|</span>
                        <Link to="/register/guardian" className="text-emerald-600 font-medium hover:underline">Register as Guardian</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;