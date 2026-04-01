// FILE: server/socket/socketHandler.js
let _io = null;

const initSocket = (io) => {
    _io = io;

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Elder or Guardian joins their own room on login
        // role='guardian' also joins guardian_${userId} room so health controller
        // can emit to `guardian_${guardianId}` consistently
        socket.on('join_room', ({ userId, role }) => {
            socket.join(userId);
            if (role === 'guardian') {
                socket.join(`guardian_${userId}`);
            }
            console.log(`👤 ${role || 'user'} ${userId} joined room(s)`);
        });

        // Elder confirms they are okay after fall detection
        socket.on('elder_ok', ({ elderId }) => {
            io.to(elderId).emit('fall_cancelled', { elderId });
            console.log(`✅ Elder ${elderId} confirmed okay`);
        });

        // Guardian acknowledges an alert
        socket.on('guardian_ack', ({ alertId, guardianId }) => {
            console.log(`✅ Guardian ${guardianId} acknowledged alert ${alertId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};

// Export so controllers can emit events
const getIO = () => {
    if (!_io) throw new Error('Socket.io not initialised yet — call initSocket first');
    return _io;
};

module.exports = { initSocket, getIO };