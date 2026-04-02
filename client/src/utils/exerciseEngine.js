export const EXERCISE_LIBRARY = {
    knee_raise: {
        id: 'knee_raise',
        name: 'Knee Raise',
        taskKeys: ['knee_raise', 'seated_march'],
        titleKeywords: ['knee raise', 'knee lift', 'march'],
        metricLabel: 'Hip angle',
        targetReps: 6,
        targetAccuracy: 70,
        idealRange: [80, 100],
        jointTriplet: [23, 25, 27],
        instruction: 'Lift one knee at a time with control until it reaches a comfortable height.',
        postureHint: 'Keep your back tall and avoid leaning too far backward.',
        repPrompt: 'Lift one knee, lower it gently, then switch sides.',
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
        targetAccuracy: 70,
        idealRange: [160, 180],
        jointTriplet: [11, 13, 15],
        mirroredTriplet: [12, 14, 16],
        instruction: 'Raise both arms smoothly to shoulder height or above, then lower them slowly.',
        postureHint: 'Relax your shoulders and keep both elbows extended.',
        repPrompt: 'Lift your arms evenly on both sides and lower them with control.',
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
        targetAccuracy: 70,
        idealRange: [160, 180],
        jointTriplet: [24, 26, 28],
        mirroredTriplet: [23, 25, 27],
        instruction: 'Extend one leg until it is nearly straight, hold for a beat, then lower.',
        postureHint: 'Stay seated upright and avoid swinging the leg quickly.',
        repPrompt: 'Straighten your leg a little more and hold it for a moment.',
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
        targetAccuracy: 70,
        idealRange: [150, 180],
        jointTriplet: [11, 13, 15],
        mirroredTriplet: [12, 14, 16],
        instruction: 'Roll your shoulders upward and back in a slow, comfortable circle.',
        postureHint: 'Keep your neck relaxed and move smoothly without shrugging sharply.',
        repPrompt: 'Roll your shoulders up, back, and down in one smooth motion.',
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

export const calculateAccuracy = (userAngle, referenceAngle) => {
    if (userAngle === null || referenceAngle === null) return 0;

    const diff = Math.abs(userAngle - referenceAngle);
    if (diff <= 10) return 100;
    if (diff <= 40) return Number((100 - (((diff - 10) / 30) * 100)).toFixed(1));
    return 0;
};

export const describeAccuracy = (accuracy, profile) => {
    if (accuracy >= 85) {
        return `Excellent form. Stay steady and keep breathing normally.`;
    }

    if (accuracy >= profile.targetAccuracy) {
        return `Good form. ${profile.postureHint}`;
    }

    if (accuracy >= 45) {
        return `Almost there. ${profile.repPrompt}`;
    }

    return `Let's reset gently. ${profile.postureHint}`;
};

export const evaluateExerciseFrame = (landmarks, getAngle, profile) => {
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

    const usableAngles = [primaryAngle, secondaryAngle].filter((value) => Number.isFinite(value));
    if (!usableAngles.length) {
        return {
            ready: false,
            userAngle: null,
            referenceAngle: null,
            accuracy: 0,
            status: 'searching',
            feedback: 'Keep your body centered and make sure the camera can see the joints clearly.',
            repDetected: false
        };
    }

    const userAngle = Math.round(usableAngles.reduce((sum, value) => sum + value, 0) / usableAngles.length);
    const [minAngle, maxAngle] = profile.idealRange;
    const referenceAngle = Math.round((minAngle + maxAngle) / 2);
    const accuracy = calculateAccuracy(userAngle, referenceAngle);
    const status = accuracy >= profile.targetAccuracy ? 'correct' : accuracy >= 45 ? 'adjust' : 'incorrect';
    const repDetected = userAngle >= minAngle && userAngle <= maxAngle;

    return {
        ready: true,
        userAngle,
        referenceAngle,
        accuracy,
        status,
        feedback: describeAccuracy(accuracy, profile),
        repDetected
    };
};
