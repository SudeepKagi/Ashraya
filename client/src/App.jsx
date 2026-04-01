// FILE: client/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import ElderRegister from './pages/auth/ElderRegister';
import GuardianRegister from './pages/auth/GuardianRegister';
import ElderDashboard from './pages/elder/ElderDashboard';
import GuardianDashboard from './pages/guardian/GuardianDashboard';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'elder' ? '/elder' : '/guardian'} replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { user, token } = useAuth();
  const elderHome = '/elder';
  const guardianHome = '/guardian';

  return (
    <Routes>
      <Route
        path="/login"
        element={token && user
          ? <Navigate to={user.role === 'elder' ? elderHome : guardianHome} replace />
          : <Login />}
      />
      <Route
        path="/register/elder"
        element={token ? <Navigate to={elderHome} replace /> : <ElderRegister />}
      />
      <Route
        path="/register/guardian"
        element={token ? <Navigate to={guardianHome} replace /> : <GuardianRegister />}
      />
      <Route
        path="/elder"
        element={
          <ProtectedRoute requiredRole="elder">
            <ElderDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian"
        element={
          <ProtectedRoute requiredRole="guardian">
            <GuardianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          token && user
            ? <Navigate to={user.role === 'elder' ? elderHome : guardianHome} replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="*"
        element={
          token && user
            ? <Navigate to={user.role === 'elder' ? elderHome : guardianHome} replace />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;