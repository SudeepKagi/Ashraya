// FILE: client/src/pages/guardian/GuardianDashboard.jsx
import { useAuth } from '../../context/AuthContext';

const GuardianDashboard = () => {
    const { user, logout } = useAuth();
    return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🛡️</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}!</h2>
                <p className="text-gray-500 mt-2 text-sm">Guardian dashboard coming in Phase 5.</p>
                <div className="mt-4 bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700 font-medium">✅ Auth system working!</div>
                <button onClick={logout} className="mt-6 text-sm text-red-500 hover:underline" aria-label="Log out">Log out</button>
            </div>
        </div>
    );
};

export default GuardianDashboard;