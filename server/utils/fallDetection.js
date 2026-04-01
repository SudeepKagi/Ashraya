const FALL_SPIKE_THRESHOLD = 2.5;   // g-force spike = fall impact
const STILL_THRESHOLD = 0.5;        // g-force stillness = body on ground
const WINDOW_MS = 1500;             // 1.5 second detection window

/**
 * Stateful fall detector — call processSample() on each accelerometer tick
 */
class FallDetector {
    constructor(onFallDetected) {
        this.onFallDetected = onFallDetected;
        this.spikeTime = null;
        this.spikeDetected = false;
    }

    /**
     * @param {{ x: number, y: number, z: number }} sample
     */
    processSample(sample) {
        const R = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);

        // Step 1: Detect spike
        if (!this.spikeDetected && R > FALL_SPIKE_THRESHOLD) {
            this.spikeDetected = true;
            this.spikeTime = Date.now();
            return;
        }

        // Step 2: After spike, watch for stillness within window
        if (this.spikeDetected) {
            const elapsed = Date.now() - this.spikeTime;

            if (elapsed > WINDOW_MS) {
                // Window expired — reset, was not a fall
                this._reset();
                return;
            }

            if (R < STILL_THRESHOLD) {
                // Fall confirmed — spike then stillness within 1.5s
                this._reset();
                this.onFallDetected({ timestamp: new Date(), magnitude: R });
            }
        }
    }

    _reset() {
        this.spikeDetected = false;
        this.spikeTime = null;
    }
}

/**
 * One-shot check for server-side validation (e.g. batch log review)
 * @param {Array<{x,y,z,timestamp}>} samples
 * @returns {boolean}
 */
const detectFallInSamples = (samples) => {
    let spikeTime = null;

    for (const s of samples) {
        const R = Math.sqrt(s.x ** 2 + s.y ** 2 + s.z ** 2);
        const t = new Date(s.timestamp).getTime();

        if (!spikeTime && R > FALL_SPIKE_THRESHOLD) {
            spikeTime = t;
            continue;
        }

        if (spikeTime) {
            if (t - spikeTime > WINDOW_MS) { spikeTime = null; continue; }
            if (R < STILL_THRESHOLD) return true;
        }
    }

    return false;
};

module.exports = { FallDetector, detectFallInSamples };