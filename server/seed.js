// FILE: server/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seed = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;

    await db.collection('users').deleteMany({ email: { $in: ['guardian@ashraya.com', 'elder@ashraya.com'] } });
    await db.collection('dailyschedules').deleteMany({});
    await db.collection('healthlogs').deleteMany({});
    await db.collection('emotionlogs').deleteMany({});
    console.log('🧹 Cleared old seed data');

    const hashedPassword = await bcrypt.hash('demo1234', 12);
    console.log('🔐 Password hashed');

    const { ObjectId } = mongoose.Types;
    const guardianId = new ObjectId();
    const elderId = new ObjectId();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.collection('users').insertOne({
        _id: guardianId,
        name: 'Suresh Kumar',
        email: 'guardian@ashraya.com',
        password: hashedPassword,
        role: 'guardian',
        phone: '9876543210',
        age: 45,
        gender: 'male',
        preferredLanguage: 'en',
        elderId: elderId,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log('✅ Guardian inserted');

    await db.collection('users').insertOne({
        _id: elderId,
        name: 'Kamala Devi',
        email: 'elder@ashraya.com',
        password: hashedPassword,
        role: 'elder',
        phone: '9123456789',
        age: 72,
        gender: 'female',
        preferredLanguage: 'en',
        guardianId: guardianId,
        profile: {
            diseases: ['diabetes', 'hypertension'],
            ongoingTreatments: ['Insulin therapy', 'BP management'],
            medicines: [
                { name: 'Metformin', dosage: '500mg', times: ['08:00', '20:00'] },
                { name: 'Amlodipine', dosage: '5mg', times: ['08:00'] },
                { name: 'Aspirin', dosage: '75mg', times: ['09:00'] }
            ],
            doctorName: 'Dr. Rajesh Sharma',
            doctorContact: '9988776655',
            emergencyContact: { name: 'Suresh Kumar', phone: '9876543210' }
        },
        accessibility: {
            hearingImpaired: false,
            visionImpaired: false,
            mobilityImpaired: false,
            cognitiveIssues: false
        },
        baseline: { restingHR: 72, avgSpO2: 97, baselineMoodScore: 7 },
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log('✅ Elder inserted');

    await db.collection('dailyschedules').insertOne({
        elderId: elderId,
        date: today,
        tasks: [
            { taskId: 'task_001', type: 'medicine', title: 'Morning Medicines', scheduledTime: '08:00', durationMinutes: 10, status: 'done', completedAt: new Date(), instructions: 'Take Metformin 500mg and Amlodipine 5mg after breakfast.' },
            { taskId: 'task_002', type: 'meal', title: 'Breakfast', scheduledTime: '08:30', durationMinutes: 30, status: 'done', completedAt: new Date(), instructions: 'Low sugar breakfast. Prefer oats or idli.' },
            { taskId: 'task_003', type: 'medicine', title: 'Aspirin Dose', scheduledTime: '09:00', durationMinutes: 5, status: 'done', completedAt: new Date(), instructions: 'Take Aspirin 75mg with a full glass of water.' },
            { taskId: 'task_004', type: 'exercise', title: 'Morning Stretches', scheduledTime: '09:30', durationMinutes: 20, status: 'pending', instructions: 'Gentle chair stretches and arm raises. 3 reps each.' },
            { taskId: 'task_005', type: 'checkin', title: 'Morning Mood Check-in', scheduledTime: '10:00', durationMinutes: 5, status: 'pending', instructions: 'Tell us how you are feeling this morning.' },
            { taskId: 'task_006', type: 'water', title: 'Drink Water', scheduledTime: '10:30', durationMinutes: 2, status: 'pending', instructions: 'Drink one full glass of water. Stay hydrated!' },
            { taskId: 'task_007', type: 'bp_report', title: 'Blood Pressure Check', scheduledTime: '11:00', durationMinutes: 10, status: 'pending', instructions: 'Sit quietly for 5 minutes. Then measure BP and report.' },
            { taskId: 'task_008', type: 'meal', title: 'Lunch', scheduledTime: '13:00', durationMinutes: 30, status: 'pending', instructions: 'Small portions. Include vegetables. Avoid fried food.' },
            { taskId: 'task_009', type: 'water', title: 'Drink Water', scheduledTime: '15:00', durationMinutes: 2, status: 'pending', instructions: 'Afternoon hydration reminder.' },
            { taskId: 'task_010', type: 'checkin', title: 'Afternoon Mood Check-in', scheduledTime: '15:30', durationMinutes: 5, status: 'pending', instructions: 'How are you feeling after lunch?' },
            { taskId: 'task_011', type: 'meal', title: 'Dinner', scheduledTime: '19:30', durationMinutes: 30, status: 'pending', instructions: 'Light dinner. Avoid heavy meals at night.' },
            { taskId: 'task_012', type: 'medicine', title: 'Evening Medicines', scheduledTime: '20:00', durationMinutes: 10, status: 'pending', instructions: 'Take Metformin 500mg after dinner.' }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log('✅ Schedule inserted');

    const healthLogs = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        healthLogs.push(
            { elderId, timestamp: date, type: 'hr', value: 68 + Math.floor(Math.random() * 15), isAnomaly: false, alertSent: false, createdAt: new Date(), updatedAt: new Date() },
            { elderId, timestamp: date, type: 'spo2', value: 95 + Math.floor(Math.random() * 3), isAnomaly: false, alertSent: false, createdAt: new Date(), updatedAt: new Date() },
            { elderId, timestamp: date, type: 'steps', value: 1200 + Math.floor(Math.random() * 800), isAnomaly: false, alertSent: false, createdAt: new Date(), updatedAt: new Date() }
        );
    }
    healthLogs.push({
        elderId, timestamp: new Date(), type: 'hr', value: 102,
        isAnomaly: true, anomalyReason: 'Heart rate too high: 102 bpm (baseline 72)',
        alertSent: true, createdAt: new Date(), updatedAt: new Date()
    });
    await db.collection('healthlogs').insertMany(healthLogs);
    console.log('✅ Health logs inserted');

    await db.collection('emotionlogs').insertOne({
        elderId,
        date: today,
        sessions: [{
            time: new Date(),
            question: 'How are you feeling this morning?',
            response: 'I am feeling okay, a little tired but good.',
            sentimentScore: 0.4,
            voiceToneScore: 6,
            emotions: ['calm', 'slightly tired']
        }],
        dailyMoodScore: 7.2,
        summary: 'Kamala Devi is in a stable mood today. Slight fatigue noted but overall positive.',
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log('✅ Emotion log inserted');

    console.log('\n🎉 Seed complete!\n');
    console.log('👴 Elder    → elder@ashraya.com     / demo1234');
    console.log('👨 Guardian → guardian@ashraya.com  / demo1234\n');

    await mongoose.disconnect();
    process.exit(0);
};

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});