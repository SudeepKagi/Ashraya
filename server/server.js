// FILE: server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const elderRoutes = require('./routes/elder');
const guardianRoutes = require('./routes/guardian');
const scheduleRoutes = require('./routes/schedule');
const healthRoutes = require('./routes/health');
const emotionRoutes = require('./routes/emotion');
const reportRoutes = require('./routes/report');
const { initSocket } = require('./socket/socketHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Attach io to every request so controllers can emit
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/elder', elderRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/emotion', emotionRoutes);
app.use('/api/report', reportRoutes);

// Health check
app.get('/api/ping', (req, res) => res.json({ status: 'Ashraya server running ✅' }));

// Error handler (must be last)
app.use(errorHandler);

// Socket.io
initSocket(io);

// Connect to MongoDB then start server
const PORT = process.env.PORT || 5000;
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected');
        server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });