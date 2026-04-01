// FILE: client/src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request automatically
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('ashraya_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle 401 globally — redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('ashraya_token');
            localStorage.removeItem('ashraya_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;