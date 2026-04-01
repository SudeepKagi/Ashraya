// FILE: client/src/context/AuthContext.jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const getSaved = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
};

const initialState = {
    user: getSaved('ashraya_user'),
    token: localStorage.getItem('ashraya_token') || null,
    loading: false,
    error: null
};

const authReducer = (state, action) => {
    switch (action.type) {
        case 'SET_LOADING': return { ...state, loading: true, error: null };
        case 'LOGIN_SUCCESS': return { ...state, loading: false, user: action.payload.user, token: action.payload.token, error: null };
        case 'AUTH_ERROR': return { ...state, loading: false, error: action.payload };
        case 'LOGOUT': return { user: null, token: null, loading: false, error: null };
        default: return state;
    }
};

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    useEffect(() => {
        if (state.token && state.user) {
            localStorage.setItem('ashraya_token', state.token);
            localStorage.setItem('ashraya_user', JSON.stringify(state.user));
            api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        } else {
            localStorage.removeItem('ashraya_token');
            localStorage.removeItem('ashraya_user');
            delete api.defaults.headers.common['Authorization'];
        }
    }, [state.token, state.user]);

    // On mount — restore token to axios if already in localStorage
    useEffect(() => {
        const token = localStorage.getItem('ashraya_token');
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }, []);

    const login = async (email, password) => {
        dispatch({ type: 'SET_LOADING' });
        try {
            const { data } = await api.post('/auth/login', { email, password });
            dispatch({ type: 'LOGIN_SUCCESS', payload: data });
            return data;
        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            dispatch({ type: 'AUTH_ERROR', payload: message });
            throw new Error(message);
        }
    };

    const registerElder = async (formData) => {
        dispatch({ type: 'SET_LOADING' });
        try {
            const { data } = await api.post('/auth/elder/register', formData);
            dispatch({ type: 'LOGIN_SUCCESS', payload: data });
            return data;
        } catch (err) {
            const message = err.response?.data?.message || 'Registration failed';
            dispatch({ type: 'AUTH_ERROR', payload: message });
            throw new Error(message);
        }
    };

    const registerGuardian = async (formData) => {
        dispatch({ type: 'SET_LOADING' });
        try {
            const { data } = await api.post('/auth/guardian/register', formData);
            dispatch({ type: 'LOGIN_SUCCESS', payload: data });
            return data;
        } catch (err) {
            const message = err.response?.data?.message || 'Registration failed';
            dispatch({ type: 'AUTH_ERROR', payload: message });
            throw new Error(message);
        }
    };

    const logout = () => {
        dispatch({ type: 'LOGOUT' });
    };

    return (
        <AuthContext.Provider value={{ ...state, login, registerElder, registerGuardian, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};