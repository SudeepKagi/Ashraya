// FILE: client/src/services/socketService.js
import { io } from 'socket.io-client';

let socket = null;

/**
 * Call once after login — connects and joins the user's room
 * @param {string} userId
 */
export const connectSocket = (userId) => {
    if (socket?.connected) return socket;

    socket = io(import.meta.env.VITE_SOCKET_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        // Join personal room so server can target this user
        socket.emit('join_room', { userId });
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    return socket;
};

/**
 * Get the active socket instance
 */
export const getSocket = () => socket;

/**
 * Disconnect cleanly (call on logout)
 */
export const disconnectSocket = () => {
    socket?.disconnect();
    socket = null;
};