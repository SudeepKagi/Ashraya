// FILE: client/src/services/socketService.js
import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (userId, role = 'elder') => {
    if (socket?.connected) return socket;

    socket = io(import.meta.env.VITE_SOCKET_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        // Send role so server puts guardian in correct room
        socket.emit('join_room', { userId, role });
    });

    socket.on('disconnect', () => console.log('Socket disconnected'));

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    socket?.disconnect();
    socket = null;
};