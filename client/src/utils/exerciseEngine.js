// FILE: client/src/utils/exerciseEngine.js

export const EXERCISE_LIBRARY = {
    knee_raise: {
        id: 'knee_raise',
        name: 'Knee Raise',
        taskKeys: ['knee_raise', 'seated_march'],
        titleKeywords: ['knee raise', 'knee lift', 'march'],
        metricLabel: 'Hip angle',
        targetReps: 6,
        targetAccuracy: 55,
        // A "rep" is counted when angle drops BELOW lowThreshold (knee up) then goes back ABOVE highThreshold (knee down)
        // Lower hip angle = knee higher up
        repLowThreshold: 110,   // angle must go below this to count "peak" (knee raised)
        repHighThreshold: 145,  // angle must return above this to reset the rep cycle
        idealRange: [90, 120],
        jointTriplet: [23, 25, 27],
        instruction: 'Lift one knee at a time with control until it reaches a comfortable height.',
        postureHint: 'Keep your back tall and avoid leaning too far backward.',
        repPrompt: 'Try to raise your knee a little higher.',
        videos: [
            { title: 'Knee Raise for Seniors', embedUrl: 'https://www.youtube-nocookie.com/embed/GXPCSeFYJPI' },
            { title: 'Standing Knee Lift Exercise', embedUrl: 'https://www.youtube-nocookie.com/embed/l7L5KUIHnic' }
        ]
    },
    arm_raise: {
        id: 'arm_raise',
        name: 'Arm Raise',
        taskKeys: ['breathing_and_arm_raises', 'arm_raise'],
        titleKeywords: ['arm raise', 'arm lift', 'breathing'],
        metricLabel: 'Shoulder angle',
        targetReps: 6,
        targetAccuracy: 55,
        // Rep: angle rises ABOVE highThreshold (arms up), then drops BELOW lowThreshold (arms down)
        repLowThreshold: 60,    // reset position: arms down
        repHighThreshold: 130,  // peak position: arms raised
        idealRange: [130, 180],
        jointTriplet: [11, 13, 15],
        mirroredTriplet: [12, 14, 16],
        instruction: 'Raise both arms smoothly to shoulder height or above, then lower them slowly.',
        postureHint: 'Relax your shoulders and keep both elbows extended.',
        repPrompt: 'Raise your arms a little higher to shoulder level.',
        videos: [
            { title: 'Lateral Arm Raise for Seniors', embedUrl: 'https://www.youtube-nocookie.com/embed/z-_lgQe9NJs' },
            { title: 'Gentle Arm Raise Tutorial', embedUrl: 'https://www.youtube-nocookie.com/embed/OyaX-TpBifY' }
        ]
    },
    seated_leg_extension: {
        id: 'seated_leg_extension',
        name: 'Seated Leg Extension',
        taskKeys: ['seated_leg_raises', 'seated_leg_extension'],
        titleKeywords: ['leg extension', 'leg raise'],
        metricLabel: 'Knee angle',
        targetReps: 6,
        targetAccuracy: 55,
        // Rep: angle rises ABOVE highThreshold (leg extended), drops BELOW lowThreshold (leg bent)
        repLowThreshold: 90,
        repHighThreshold: 145,
        idealRange: [145, 180],
        jointTriplet: [24, 26, 28],
        mirroredTriplet: [23, 25, 27],
        instruction: 'Extend one leg until it is nearly straight, hold for a beat, then lower.',
        postureHint: 'Stay seated upright and avoid swinging the leg quickly.',
        repPrompt: 'Try to straighten your leg a little more.',
        videos: [
            { title: 'Seated Leg Extension for Seniors', embedUrl: 'https://www.youtube-nocookie.com/embed/ZLqvDBFHp4E' },
            { title: 'Chair Leg Extension Exercise', embedUrl: 'https://www.youtube-nocookie.com/embed/ZNZXBDdJWns' }
        ]
    },
    shoulder_roll: {
        id: 'shoulder_roll',
        name: 'Shoulder Roll',
        taskKeys: ['shoulder_roll', 'neck_stretches'],
        titleKeywords: ['shoulder roll', 'neck stretch'],
        metricLabel: 'Shoulder angle',
        targetReps: 5,
        targetAccuracy: 50,
        repLowThreshold: 60,
        repHighThreshold: 130,
        idealRange: [120, 180],
        jointTriplet: [11, 13, 15],
        mirroredTriplet: [12, 14, 16],
        instruction: 'Roll your shoulders upward and back in a slow, comfortable circle.',
        postureHint: 'Keep your neck relaxed and move smoothly without shrugging sharply.',
        repPrompt: 'Make the rolling motion a bit bigger — up, back, and down.',
        videos: [
            { title: 'Shoulder Roll for Seniors', embedUrl: 'https://www.youtube-nocookie.com/embed/XbzY45Z5DE8' },
            { title: 'Gentle Shoulder Rolls Exercise', embedUrl: 'https://www.youtube-nocookie.com/embed/jOP3auIWbEs' }
        ]
    }
};

const DEFAULT_EXERCISE = EXERCISE_LIBRARY.arm_raise;

const byTaskKey = Object.values(EXERCISE_LIBRARY).flatMap((item) =>
    item.taskKeys.map((key) => [key, item])
);

export const resolveExerciseProfile = (task) => {
    const exerciseType = task?.exerciseType?.toLowerCase?.();
    if (exerciseType) {
        const exact = byTaskKey.find(([key]) => key === exerciseType);
        if (exact) return exact[1];
    }

    const title = `${task?.title || ''} ${task?.instructions || ''}`.toLowerCase();
    const match = Object.values(EXERCISE_LIBRARY).find((item) =>
        item.titleKeywords.some((keyword) => title.includes(keyword))
    );

    return match || DEFAULT_EXERCISE;
};

/**
 * Calculate accuracy based on how close the user's range-of-motion (ROM) is
 * to the ideal range for the exercise.
 *
 * Instead of comparing to a static midpoint, we check:
 * 1. Whether the angle is WITHIN the ideal range → high accuracy
 * 2. How far it is from the nearest edge of the ideal range → partial accuracy
 */
export const calculateAccuracy = (userAngle, profile) => {
    if (userAngle === null || userAngle === undefined) return 0;

    const [minAngle, maxAngle] = profile.idealRange;

    // Angle is within ideal range → close to perfect
    if (userAngle >= minAngle && userAngle <= maxAngle) {
        // Score within range: 75-100 based on how centred the angle is
        const mid = (minAngle + maxAngle) / 2;
        const halfRange = (maxAngle - minAngle) / 2;
        const distFromMid = Math.abs(userAngle - mid);
        return Math.round(100 - (distFromMid / halfRange) * 25);
    }

    // Below the range (not reached target)
    if (userAngle < minAngle) {
        const gap = minAngle - userAngle;
        if (gap <= 15) return Math.round(75 - (gap / 15) * 30);  // 45–75
        if (gap <= 40) return Math.round(45 - ((gap - 15) / 25) * 30); // 15–45
        return Math.max(0, Math.round(15 - ((gap - 40) / 20) * 15));   // 0–15
    }

    // Above the range (overextension — still OK, slight deduction)
    const gap = userAngle - maxAngle;
    if (gap <= 20) return Math.round(100 - (gap / 20) * 20); // 80–100 (slight over is fine)
    return Math.max(50, Math.round(80 - ((gap - 20) / 30) * 30));
};

export const describeAccuracy = (accuracy, status, profile) => {
    if (status === 'searching') return 'Move back so your full body is visible in the frame.';
    if (accuracy >= 90) return 'Excellent form. Keep breathing steadily and maintain this position.';
    if (accuracy >= 75) return `Good form! ${profile.postureHint}`;
    if (accuracy >= 55) return `Almost there. ${profile.repPrompt}`;
    if (accuracy >= 30) return `Try a bigger movement. ${profile.repPrompt}`;
    return `Reset gently and try again. ${profile.postureHint}`;
};

// ── Stateful rep-cycle tracker (exported so ExerciseModule can hold it in a ref) ──
export const createRepTracker = () => ({
    phase: 'rest',  // 'rest' | 'peak'
    lastRepAngle: null,
});

/**
 * Evaluate a single pose frame.
 * Returns: { ready, userAngle, referenceAngle, accuracy, status, feedback, repDetected }
 *
 * Rep counting logic (bidirectional cycle):
 *   For exercises where angle INCREASES to count a rep (arm_raise, leg_extension, shoulder_roll):
 *     - phase starts as 'rest'
 *     - when angle > repHighThreshold → phase = 'peak'
 *     - when angle < repLowThreshold AND phase was 'peak' → rep counted, phase = 'rest'
 *
 *   For exercises where angle DECREASES to count a rep (knee_raise):
 *     - phase starts as 'rest'
 *     - when angle < repLowThreshold → phase = 'peak'
 *     - when angle > repHighThreshold AND phase was 'peak' → rep counted, phase = 'rest'
 */
export const evaluateExerciseFrame = (landmarks, getAngle, profile, repTracker) => {
    if (!landmarks?.length) {
        return {
            ready: false,
            userAngle: null,
            referenceAngle: null,
            accuracy: 0,
            status: 'searching',
            feedback: 'Move back slightly so your full body is visible in the frame.',
            repDetected: false
        };
    }

    const readAngle = (triplet) => getAngle(landmarks[triplet[0]], landmarks[triplet[1]], landmarks[triplet[2]]);
    const primaryAngle = readAngle(profile.jointTriplet);
    const secondaryAngle = profile.mirroredTriplet ? readAngle(profile.mirroredTriplet) : null;

    const usableAngles = [primaryAngle, secondaryAngle].filter((v) => Number.isFinite(v));
    if (!usableAngles.length) {
        return {
            ready: false,
            userAngle: null,
            referenceAngle: null,
            accuracy: 0,
            status: 'searching',
            feedback: 'Keep your body centered so the camera can see the joints clearly.',
            repDetected: false
        };
    }

    // Use the best angle for rep detection: for mirrored exercises take the one closer to ideal range
    const [minAngle, maxAngle] = profile.idealRange;
    const midIdeal = (minAngle + maxAngle) / 2;
    const userAngle = Math.round(
        usableAngles.length > 1
            ? usableAngles.reduce((best, a) => Math.abs(a - midIdeal) < Math.abs(best - midIdeal) ? a : best)
            : usableAngles[0]
    );

    // Reference angle = ideal midpoint (for display purposes)
    const referenceAngle = Math.round(midIdeal);
    const accuracy = calculateAccuracy(userAngle, profile);
    const status = accuracy >= profile.targetAccuracy ? 'correct' : accuracy >= 35 ? 'adjust' : 'incorrect';

    // ── Rep cycle detection ──
    let repDetected = false;
    if (repTracker) {
        const isKneeStyle = profile.repLowThreshold < profile.repHighThreshold &&
            profile.idealRange[1] < profile.repHighThreshold;

        if (isKneeStyle) {
            // Knee-raise style: angle goes DOWN to peak
            if (repTracker.phase === 'rest' && userAngle <= profile.repLowThreshold) {
                repTracker.phase = 'peak';
            } else if (repTracker.phase === 'peak' && userAngle >= profile.repHighThreshold) {
                repTracker.phase = 'rest';
                repDetected = true;
            }
        } else {
            // Arm-raise / leg-extension style: angle goes UP to peak
            if (repTracker.phase === 'rest' && userAngle >= profile.repHighThreshold) {
                repTracker.phase = 'peak';
            } else if (repTracker.phase === 'peak' && userAngle <= profile.repLowThreshold) {
                repTracker.phase = 'rest';
                repDetected = true;
            }
        }
    }

    return {
        ready: true,
        userAngle,
        referenceAngle,
        accuracy,
        status,
        feedback: describeAccuracy(accuracy, status, profile),
        repDetected
    };
};
