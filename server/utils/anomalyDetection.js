// FILE: server/utils/anomalyDetection.js

/**
 * Anomaly Detection for Health Metrics
 * Compares current reading to elder's stored baseline
 */

// Thresholds — how far from baseline before flagging
const THRESHOLDS = {
    hr: { low: 20, high: 25 },      // bpm deviation
    spo2: { low: 4, high: null },   // SpO2 only goes low (below baseline)
    bp_systolic: { low: 20, high: 30 },
    bp_diastolic: { low: 10, high: 20 },
    steps: { low: null, high: null } // no anomaly for steps
};

/**
 * @param {'hr'|'spo2'|'bp'|'steps'} type
 * @param {number|object} value  — bp expects { systolic, diastolic }
 * @param {{ restingHR, avgSpO2 }} baseline — from User.baseline
 * @returns {{ isAnomaly: boolean, reason: string|null }}
 */
const checkAnomaly = (type, value, baseline) => {
    if (!baseline) return { isAnomaly: false, reason: null };

    try {
        if (type === 'hr') {
            const diff = value - (baseline.restingHR || 70);
            if (diff > THRESHOLDS.hr.high)
                return { isAnomaly: true, reason: `Heart rate too high: ${value} bpm (baseline ${baseline.restingHR})` };
            if (diff < -THRESHOLDS.hr.low)
                return { isAnomaly: true, reason: `Heart rate too low: ${value} bpm (baseline ${baseline.restingHR})` };
        }

        if (type === 'spo2') {
            const drop = (baseline.avgSpO2 || 98) - value;
            if (drop > THRESHOLDS.spo2.low)
                return { isAnomaly: true, reason: `SpO2 dropped to ${value}% (baseline ${baseline.avgSpO2}%)` };
            if (value < 90)
                return { isAnomaly: true, reason: `Critical SpO2: ${value}% — seek immediate help` };
        }

        if (type === 'bp') {
            const { systolic, diastolic } = value;
            if (systolic > 180 || diastolic > 120)
                return { isAnomaly: true, reason: `Hypertensive crisis: ${systolic}/${diastolic} mmHg` };
            if (systolic < 90)
                return { isAnomaly: true, reason: `Very low BP: ${systolic}/${diastolic} mmHg` };
        }

        return { isAnomaly: false, reason: null };

    } catch {
        return { isAnomaly: false, reason: null };
    }
};

module.exports = { checkAnomaly };