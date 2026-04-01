// FILE: client/src/hooks/useNotifications.js
import { useState, useEffect } from 'react';
import api from '../services/api';

const useNotifications = () => {
    const [permission, setPermission] = useState(Notification.permission);
    const [supported] = useState('Notification' in window);

    useEffect(() => {
        setPermission(Notification.permission);
    }, []);

    const requestPermission = async () => {
        if (!supported) return false;
        const result = await Notification.requestPermission();
        setPermission(result);
        return result === 'granted';
    };

    /**
     * Show a local browser notification (works without FCM for demo)
     */
    const showNotification = (title, body, options = {}) => {
        if (permission !== 'granted') return;
        new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        });
    };

    /**
     * Save FCM token to server (called after Firebase init in production)
     */
    const saveFcmToken = async (token) => {
        try {
            await api.put('/elder/profile', { fcmToken: token });
        } catch (err) {
            console.error('Failed to save FCM token:', err.message);
        }
    };

    return { permission, supported, requestPermission, showNotification, saveFcmToken };
};

export default useNotifications;