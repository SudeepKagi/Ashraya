// FILE: client/src/services/fallDetection.js
const FALL_SPIKE_THRESHOLD = 2.5;
const STILL_THRESHOLD = 0.5;
const WINDOW_MS = 1500;

export class FallDetector {
    constructor(onFallDetected) {
        this.onFallDetected = onFallDetected;
        this.spikeTime = null;
        this.spikeDetected = false;
    }

    processSample({ x, y, z }) {
        const R = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

        if (!this.spikeDetected && R > FALL_SPIKE_THRESHOLD) {
            this.spikeDetected = true;
            this.spikeTime = Date.now();
            return;
        }

        if (this.spikeDetected) {
            const elapsed = Date.now() - this.spikeTime;
            if (elapsed > WINDOW_MS) { this._reset(); return; }
            if (R < STILL_THRESHOLD) {
                this._reset();
                this.onFallDetected({ timestamp: new Date() });
            }
        }
    }

    _reset() {
        this.spikeDetected = false;
        this.spikeTime = null;
    }
}