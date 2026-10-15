# Ashraya

Ashraya is a full-stack elder care management platform that connects elders with their guardians through real-time health monitoring, daily scheduling, emotion tracking, and voice assistance. It is built for caregivers, family members, and seniors who need a centralized system to manage health logs, daily tasks, and automated alerts.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Tests](#tests)
- [Seed Data](#seed-data)

## Features

- **Role-based access**: Separate dashboards for guardians and elders with protected routes.
- **Daily scheduling**: AI-generated daily schedules with tasks for medicine, meals, exercise, and check-ins.
- **Health logging**: Record heart rate, SpO2, blood pressure, steps, falls, and SOS events with anomaly detection.
- **Emotion tracking**: Log mood check-ins with AI-driven sentiment and mood analysis via OpenAI.
- **Voice assistant**: Transcribe audio and generate companion replies using OpenAI models.
- **Real-time alerts**: Socket.IO-based notifications for guardians on health anomalies and emotion concerns.
- **Daily reports**: Generate and view HTML-based daily summaries of elder activity and health status.

## Requirements

- **Node.js** and **npm** for both the server and client.
- **MongoDB** for data persistence.
- **OpenAI API key** for emotion analysis and voice transcription.
- **Firebase credentials** for push notifications (optional).
- **GROQ API key** (optional, if used).

## Installation

### Server

Clone the repository and install dependencies in the `server` directory.

```shell
cd server
npm install
```

### Client

Install dependencies in the `client` directory.

```shell
cd client
npm install
```

## Configuration

Copy the example environment file in the `server` directory and fill in your values.

```shell
cp server/.env.example server/.env
```

### Required Environment Variables

- `PORT`: Application port (default `5000`).
- `MONGODB_URI`: MongoDB connection string.
- `JWT_SECRET`: Secret for signing JWT tokens.
- `JWT_EXPIRES_IN`: Token expiration (default `7d`).
- `OPENAI_API_KEY`: OpenAI API key.
- `OPENAI_MODEL`: Model for general AI requests (default `gpt-4o-mini`).
- `OPENAI_TRANSCRIBE_MODEL`: Model for audio transcription (default `gpt-4o-mini-transcribe`).
- `CLIENT_URL`: Origin URL for Socket.IO CORS (default `http://localhost:5173`).

### Optional Environment Variables

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: For push notifications.
- `GROQ_API_KEY`: For GROQ-based services.

## Usage

### Running the Server

Start the server in development mode with auto-restart.

```shell
cd server
npm run dev
```

Start the server in production mode.

```shell
cd server
npm start
```

### Running the Client

Start the Vite development server.

```shell
cd client
npm run dev
```

Build the client for production.

```shell
cd client
npm run build
```

Preview the production build locally.

```shell
cd client
npm run preview
```

### Seeding the Database

Run the seed script to populate MongoDB with sample guardian and elder data.

```shell
cd server
node seed.js
```

Default seed credentials:

- **Elder**: `elder@ashraya.com` / `demo1234`
- **Guardian**: `guardian@ashraya.com` / `demo1234`

## API Reference

All API routes are prefixed with `/api` and use Bearer JWT authentication.

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/elder/register`
- `POST /api/auth/guardian/register`
- `GET /api/auth/me`

### Elder

- `GET /api/elder/profile`
- `PUT /api/elder/profile`
- `GET /api/elder/dashboard`

### Guardian

- `GET /api/guardian` — Aggregated elder summary, today's stats, mood, anomalies, and latest health readings.
- `GET /api/guardian/alerts?days=1&limit=20` — Health and emotion alerts for the linked elder.

### Schedule

- `GET /api/schedule/today` — Today's tasks and completion statistics.
- `POST /api/schedule/generate` — Regenerate the daily schedule.
- `PUT /api/schedule/task/:taskId` — Update task status (`pending`, `done`, `skipped`, `refused`).
- `GET /api/schedule/history?elderId=<id>` — Past daily schedules (guardian view).

### Health

- `POST /api/health/log` — Log a health metric (e.g., `hr`, `spo2`, `bp`, `steps`).
- `POST /api/health/fall` — Log a fall or manual SOS alert.
- `POST /api/health/guardian-alert` — Send a custom alert to the guardian.

### Emotion

- `POST /api/emotion/checkin` — Submit a mood check-in with optional voice tone score.
- `GET /api/emotion/today` — Today's emotion log.
- `GET /api/emotion/trend/:elderId` — 7-day mood trend.

### Voice

- `POST /api/voice/transcribe` — Transcribe uploaded audio (base64 encoded).
- `POST /api/voice/respond` — Generate a voice companion reply.

### Reports

- `GET /api/report/today` — Generate today's daily report.
- `POST /api/report/generate` — Generate a report for a specific date.
- `GET /api/report/history?limit=14` — Retrieve past reports.
- `GET /api/report/pdf/:reportId` — Retrieve a report as HTML.

### Health Check

- `GET /api/ping` — Confirm the server is running.

## Project Structure

### Server

- `server.js`: Express application entry point. Configures middleware, routes, Socket.IO, and MongoDB connection.
- `controllers/`: Route handlers for auth, elder, guardian, schedule, health, emotion, report, and voice.
- `middleware/`: Authentication (`auth.js`) and centralized error handling (`errorHandler.js`).
- `models/`: Mongoose schemas for `User`, `DailySchedule`, `DailyReport`, `EmotionLog`, `HealthLog`, and `Task`.
- `routes/`: Express route definitions.
- `services/`: Business logic for AI analysis, notifications, reports, and scheduling.
- `socket/`: Socket.IO initialization and handler.
- `utils/`: Anomaly detection and fall detection utilities.
- `seed.js`: Database seeding script.

### Client

- `src/main.jsx`: React entry point.
- `src/App.jsx`: Router setup with role-based protected routes.
- `src/pages/`: Page components for auth (Login, ElderRegister, GuardianRegister) and dashboards (ElderDashboard, GuardianDashboard).
- `src/components/`: UI components for common elements, elder modules (EmotionCheckin, ExerciseModule, MedicineVerifier, TaskCard), and guardian views (AlertFeed, ElderSummaryCard, ReportViewer).
- `src/context/`: Global state providers for authentication and accessibility.
- `src/services/`: API client logic.
- `src/utils/`: Client-side utilities.
- `vite.config.js`: Vite build configuration with React and TailwindCSS plugins.
- `tailwind.config.js`: Tailwind theme customization.

## Tests

No test suite is present in the repository.

## Seed Data

The `server/seed.js` script inserts a default guardian (`Suresh Kumar`, `guardian@ashraya.com`) and elder (`Kamala Devi`, `elder@ashraya.com`) with a 12-task daily schedule, historical health logs, and an emotion log. Run `node seed.js` from the `server` directory to populate the database.