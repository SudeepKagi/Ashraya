// FILE: client/src/hooks/useBluetooth.js
import { useState, useRef, useCallback } from 'react';

// Standard Bluetooth GATT UUIDs
const HEART_RATE_SERVICE = 0x180D;
const HEART_RATE_MEASUREMENT = 0x2A37;
const BATTERY_SERVICE = 0x180F;
const BATTERY_LEVEL = 0x2A19;

// Noise smartwatches use a proprietary service for full data.
// We request heart_rate (standard) and accept all devices so user can pick their watch.
// Accelerometer data is read via a custom characteristic (manufacturer-specific).
// Fall detection runs on the last known accel reading polled every 100ms.
const NOISE_ACCEL_SERVICE = '0000ffd0-0000-1000-8000-00805f9b34fb'; // Common Noise BLE profile

const useBluetooth = () => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('disconnected'); // disconnected|connecting|connected|error|simulating
    const [error, setError] = useState(null);
    const [vitals, setVitals] = useState({
        hr: null,
        spo2: null,
        bp: null,
        battery: null,
        steps: null,
        source: 'idle'
    });

    const deviceRef = useRef(null);
    const sampleCallbackRef = useRef(null);
    const simulationRef = useRef(null);

    const registerSampleCallback = useCallback((fn) => {
        sampleCallbackRef.current = fn;
    }, []);

    // ── Real BLE connection ────────────────────────────────────────────────
    const connect = useCallback(async () => {
        if (!navigator.bluetooth) {
            // Browser doesn't support Web Bluetooth — offer simulation mode
            startSimulation();
            return;
        }

        setStatus('connecting');
        setError(null);

        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    HEART_RATE_SERVICE,
                    BATTERY_SERVICE,
                    NOISE_ACCEL_SERVICE
                ]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', () => {
                setConnected(false);
                setStatus('disconnected');
                setVitals({ hr: null, spo2: null, battery: null });
            });

            const server = await device.gatt.connect();

            // Subscribe to Heart Rate notifications (standard GATT)
            try {
                const hrService = await server.getPrimaryService(HEART_RATE_SERVICE);
                const hrChar = await hrService.getCharacteristic(HEART_RATE_MEASUREMENT);
                await hrChar.startNotifications();
                hrChar.addEventListener('characteristicvaluechanged', (e) => {
                    const flags = e.target.value.getUint8(0);
                    // Bit 0: 0 = HR is uint8, 1 = HR is uint16
                const hr = (flags & 0x01) ? e.target.value.getUint16(1, true) : e.target.value.getUint8(1);
                    setVitals(v => ({ ...v, hr, source: 'watch' }));

                    // Feed into fall detector as a heartbeat "alive" signal
                    if (sampleCallbackRef.current) {
                        sampleCallbackRef.current({ type: 'hr', value: hr });
                    }
                });
            } catch {
                console.warn('Heart Rate service not available on this device');
            }

            // Try battery level (optional)
            try {
                const batService = await server.getPrimaryService(BATTERY_SERVICE);
                const batChar = await batService.getCharacteristic(BATTERY_LEVEL);
                const batVal = await batChar.readValue();
                setVitals(v => ({ ...v, battery: batVal.getUint8(0), source: 'watch' }));
            } catch {
                console.warn('Battery service not available');
            }

            // Try Noise proprietary accel service (will fail on non-Noise devices)
            try {
                const accelService = await server.getPrimaryService(NOISE_ACCEL_SERVICE);
                // Noise typically exposes characteristic 0xFFD1 for accel data
                const accelChar = await accelService.getCharacteristic('0000ffd1-0000-1000-8000-00805f9b34fb');
                await accelChar.startNotifications();
                accelChar.addEventListener('characteristicvaluechanged', (e) => {
                    // Noise watch sends: x(int16), y(int16), z(int16) as little-endian
                    const data = e.target.value;
                    const x = data.getInt16(0, true) / 1000; // convert mg to g
                    const y = data.getInt16(2, true) / 1000;
                    const z = data.getInt16(4, true) / 1000;
                    if (sampleCallbackRef.current) {
                        sampleCallbackRef.current({ type: 'accel', x, y, z });
                    }
                });
            } catch {
                console.warn('Noise accelerometer service not available — using HR-only mode');
            }

            setConnected(true);
            setStatus('connected');
            setVitals((current) => ({
                ...current,
                source: 'watch'
            }));

        } catch (err) {
            if (err.name === 'NotFoundError') {
                // User cancelled device picker — not really an error
                setStatus('disconnected');
            } else {
                setError(`${err.message}. Try simulation mode.`);
                setStatus('error');
            }
        }
    }, []);

    // ── Simulation mode for demo / non-BLE environments ───────────────────
    const startSimulation = useCallback(() => {
        setStatus('simulating');
        setConnected(true);
        setError(null);

        let simHR = 72;
        let simSpO2 = 98;
        let simSystolic = 122;
        let simDiastolic = 81;
        let simSteps = 1240;

        simulationRef.current = setInterval(() => {
            simHR = Math.min(90, Math.max(65, simHR + (Math.random() - 0.5) * 4));
            simSpO2 = Math.min(100, Math.max(95, simSpO2 + (Math.random() - 0.5) * 0.5));
            simSystolic = Math.min(138, Math.max(112, simSystolic + (Math.random() - 0.5) * 3));
            simDiastolic = Math.min(92, Math.max(72, simDiastolic + (Math.random() - 0.5) * 2));
            simSteps += Math.round(Math.random() * 12);

            setVitals({
                hr: Math.round(simHR),
                spo2: Math.round(simSpO2 * 10) / 10,
                bp: {
                    systolic: Math.round(simSystolic),
                    diastolic: Math.round(simDiastolic)
                },
                battery: 85,
                steps: simSteps,
                source: 'simulation'
            });

            const x = (Math.random() - 0.5) * 0.4;
            const y = (Math.random() - 0.5) * 0.4;
            const z = 1.0 + (Math.random() - 0.5) * 0.3;

            if (sampleCallbackRef.current) {
                sampleCallbackRef.current({ type: 'accel', x, y, z });
                sampleCallbackRef.current({ type: 'hr', value: Math.round(simHR) });
                sampleCallbackRef.current({ type: 'spo2', value: Math.round(simSpO2 * 10) / 10 });
                sampleCallbackRef.current({
                    type: 'bp',
                    value: {
                        systolic: Math.round(simSystolic),
                        diastolic: Math.round(simDiastolic)
                    }
                });
                sampleCallbackRef.current({ type: 'steps', value: simSteps });
            }
        }, 1000);
    }, []);

    const disconnect = useCallback(async () => {
        if (simulationRef.current) {
            clearInterval(simulationRef.current);
            simulationRef.current = null;
        }
        if (deviceRef.current?.gatt?.connected) {
            deviceRef.current.gatt.disconnect();
        }
        setConnected(false);
        setStatus('disconnected');
        setVitals({ hr: null, spo2: null, bp: null, battery: null, steps: null, source: 'idle' });
    }, []);

    // Trigger a simulated fall (for demo)
    const simulateFall = useCallback(() => {
        if (!sampleCallbackRef.current) return;
        // Spike: R > 2.5g
        sampleCallbackRef.current({ type: 'accel', x: 2.0, y: 1.5, z: 0.5 });
        // Then stillness: R < 0.5g after 300ms
        setTimeout(() => {
            sampleCallbackRef.current({ type: 'accel', x: 0.1, y: 0.1, z: 0.2 });
        }, 300);
    }, []);

    return {
        connected, status, error, vitals,
        connect, disconnect, simulateFall,
        registerSampleCallback,
        startSimulation,
        isSimulating: status === 'simulating'
    };
};

export default useBluetooth;
