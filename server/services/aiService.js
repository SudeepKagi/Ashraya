// FILE: server/services/aiService.js
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const chat = (prompt, maxTokens = 4000) => groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
        {
            role: 'system',
            content: 'You are a JSON-only API. Return ONLY raw JSON array. No markdown, no code fences, no explanation. Ever.'
        },
        { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: maxTokens
});

const chatText = (prompt, maxTokens = 1000) => groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
        {
            role: 'system',
            content: 'You are a concise caregiving assistant. Return plain text only.'
        },
        { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: maxTokens
});

const extractJSON = (raw) => {
    let cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1 || end < start) {
        throw new Error('AI returned invalid JSON. Raw: ' + raw.slice(0, 300));
    }

    return cleaned.slice(start, end + 1);
};

const generateDailySchedule = async (elderProfile) => {
    const { age, profile, accessibility } = elderProfile;
    const { diseases = [], ongoingTreatments = [], medicines = [] } = profile || {};

    const accessibilityFlags = [];
    if (accessibility?.hearingImpaired) accessibilityFlags.push('hearing impaired');
    if (accessibility?.visionImpaired) accessibilityFlags.push('vision impaired');
    if (accessibility?.mobilityImpaired) accessibilityFlags.push('mobility impaired');
    if (accessibility?.cognitiveIssues) accessibilityFlags.push('cognitive issues');

    // Build valid medicines only
    const validMedicines = medicines.filter(m => m.name && m.dosage);

    // Build explicit medicine task list — one entry per medicine per time
    // This is injected as MANDATORY tasks the AI must include
    const mandatoryMedicineTasks = [];
    validMedicines.forEach((m) => {
        const times = m.times && m.times.length > 0 ? m.times : ['08:00'];
        times.forEach((time) => {
            mandatoryMedicineTasks.push({
                taskId: `medicine_${m.name.replace(/\s+/g, '_').toLowerCase()}_${time.replace(':', '')}`,
                type: 'medicine',
                title: `Take ${m.name}`,
                scheduledTime: time,
                durationMinutes: 5,
                instructions: `Take ${m.dosage} of ${m.name}. Do not skip this dose.`
            });
        });
    });

    // If all medicines are pre-built, we can inject them directly
    // and only ask AI to generate the non-medicine tasks
    const medicineTasksJSON = JSON.stringify(mandatoryMedicineTasks, null, 2);

    const prompt = `You are a medical care scheduler for elderly patients. Generate a daily schedule.

Patient profile:
- Age: ${age || 70}
- Diseases: ${diseases.length ? diseases.join(', ') : 'None'}
- Ongoing treatments: ${ongoingTreatments.length ? ongoingTreatments.join(', ') : 'None'}
- Accessibility needs: ${accessibilityFlags.length ? accessibilityFlags.join(', ') : 'None'}

INSTRUCTIONS:
- Write ALL text in ENGLISH ONLY. No non-ASCII characters.
- Return a single flat JSON array of task objects.
- Do NOT wrap in any object. Just a raw array: [ {...}, {...} ]

MANDATORY MEDICINE TASKS — include ALL of these exactly as given, do not modify them:
${medicineTasksJSON}

ADDITIONAL TASKS TO GENERATE (add these alongside the medicine tasks):
- Water reminders every 2 hours from 07:00 to 20:00 (type: "water")
- Morning exercise at 07:00 (type: "exercise", chair-based if mobility impaired, intensity based on disease)
- Meals at 08:00, 13:00, 19:00 (type: "meal")
- Emotion check-ins at 08:30, 13:30, 17:00, 20:30 (type: "checkin")
${diseases.some(d => ['Hypertension', 'Heart Disease'].includes(d)) ? '- BP self-report at 09:00 (type: "bp_report")' : ''}
- End-of-day review at 21:00 (type: "checkin", title: "End of Day Review")

Each task object must have exactly these fields:
{
  "taskId": "unique_snake_case_string",
  "type": "water|medicine|exercise|meal|checkin|bp_report",
  "title": "short English title",
  "scheduledTime": "HH:MM",
  "durationMinutes": number,
  "instructions": "brief English instructions"
}

For exercise tasks only, also include: "exerciseType": "description of exercise"

Return the complete array sorted by scheduledTime. ENGLISH ONLY. No markdown.`;

    const response = await chat(prompt, 4000);
    const raw = response.choices[0].message.content.trim();

    let tasks;
    try {
        const jsonStr = extractJSON(raw);
        tasks = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error('AI returned invalid JSON. Raw: ' + raw.slice(0, 300));
    }

    if (!Array.isArray(tasks)) throw new Error('AI schedule must be an array');

    // Safety net: ensure mandatory medicine tasks are always present
    // even if AI dropped them
    const taskIds = new Set(tasks.map(t => t.taskId));
    for (const mt of mandatoryMedicineTasks) {
        if (!taskIds.has(mt.taskId)) {
            tasks.push(mt);
        }
    }

    // Sort by scheduledTime
    tasks.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return tasks;
};

const analyseEmotion = async ({ question, response, language }) => {
    const prompt = `Analyse this elderly person's response to a health check-in question.

Question: "${question}"
Response: "${response}"
Language hint: ${language || 'en'}

Return ONLY valid JSON (no markdown, no explanation):
{
  "sentimentScore": number between -1 (very negative) and 1 (very positive),
  "emotions": ["array", "of", "detected", "emotions"],
  "moodLabel": "happy|neutral|sad|anxious|confused",
  "concernFlag": boolean,
  "summary": "one sentence summary"
}`;

    const result = await chat(prompt, 1000);
    const raw = result.choices[0].message.content.trim();

    try {
        const jsonStr = extractJSON(raw);
        return JSON.parse(jsonStr);
    } catch {
        return {
            sentimentScore: 0, emotions: [],
            moodLabel: 'neutral', concernFlag: false, summary: response
        };
    }
};

const generateDailyReportSummary = async ({ elder, schedule, emotionLog, healthLogs }) => {
    const tasksDone = schedule.tasks.filter(t => t.status === 'done').length;
    const tasksTotal = schedule.tasks.length;
    const moodScore = emotionLog?.dailyMoodScore || 5;

    const prompt = `Generate a warm, concise daily health summary for a caregiver about their elderly family member.

Elder: ${elder.name}, Age ${elder.age}
Tasks completed: ${tasksDone}/${tasksTotal}
Mood score today: ${moodScore}/10
Health alerts: ${healthLogs?.filter(l => l.isAnomaly).length || 0}
Diseases: ${elder.profile?.diseases?.join(', ') || 'None'}

Write 3-4 sentences. Be warm and clear. Mention key concerns if any. No markdown.`;

    const result = await chatText(prompt, 1000);
    return result.choices[0].message.content.trim();
};

const generateVoiceCompanionReply = async ({ elderName, query, nextTask, moodSignals = [] }) => {
    const prompt = `You are Ashraya, a warm voice companion for an elderly user.

User name: ${elderName || 'friend'}
User said: "${query}"
Next scheduled task: ${nextTask ? `${nextTask.title} at ${nextTask.scheduledTime}` : 'No pending task'}
Mood hints from recent speech: ${moodSignals.length ? moodSignals.join(', ') : 'none'}

Reply as a calm, spoken-style assistant:
- Keep it to 2 or 3 short sentences.
- Be gentle, reassuring, and practical.
- If the user sounds sad, lonely, anxious, or tired, respond with extra warmth.
- If they ask about their routine, mention the next task when helpful.
- Do not use markdown, bullet points, or labels.
- Return plain text only.`;

    const result = await chatText(prompt, 300);
    return result.choices[0].message.content.trim();
};

module.exports = { generateDailySchedule, analyseEmotion, generateDailyReportSummary, generateVoiceCompanionReply };
