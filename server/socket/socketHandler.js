// FILE: server/socket/socketHandler.js
const initSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Elder or Guardian joins their own room on login
        socket.on('join_room', ({ userId }) => {
            socket.join(userId);
            console.log(`👤 User ${userId} joined room`);
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

module.exports = { initSocket };