// FILE: client/src/hooks/useBluetooth.js
import { useState, useRef, useCallback } from 'react';

// ── Standard Bluetooth GATT UUIDs ─────────────────────────────────────────
const HEART_RATE_SERVICE = 0x180D;
const HEART_RATE_MEASUREMENT = 0x2A37;
const BATTERY_SERVICE = 0x180F;
const BATTERY_LEVEL = 0x2A19;

// ── Noise / FT-series proprietary UUIDs ──────────────────────────────────
// FT_38083_A913 and similar Noise watches expose a proprietary service.
// We declare ALL known UUIDs upfront — the browser blocks access to any
// service not listed here even after pairing (SecurityError).
const NOISE_ACCEL_SERVICE = '0000ffd0-0000-1000-8000-00805f9b34fb';
const NOISE_ACCEL_CHAR = '0000ffd1-0000-1000-8000-00805f9b34fb';

// Some Noise / FT-series watches expose health data on these alternative UUIDs
const NOISE_HEALTH_SERVICE = '0000fee0-0000-1000-8000-00805f9b34fb';
const NOISE_HEALTH_CHAR = '0000fee1-0000-1000-8000-00805f9b34fb';

// Declare every service we might read — required for acceptAllDevices mode
const OPTIONAL_SERVICES = [
    HEART_RATE_SERVICE,
    BATTERY_SERVICE,
    NOISE_ACCEL_SERVICE,
    NOISE_HEALTH_SERVICE,
    'device_information',
];

const EMPTY_VITALS = {
    hr: null, spo2: null, bp: null,
    battery: null, steps: null, source: 'idle'
};

const useBluetooth = () => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('disconnected');
    const [error, setError] = useState(null);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const [deviceName, setDeviceName] = useState(null);
    const [debugLog, setDebugLog] = useState([]);  // visible in UI for diagnosis

    const deviceRef = useRef(null);
    const serverRef = useRef(null);
    const sampleCallbackRef = useRef(null);
    const simulationRef = useRef(null);
    const hrPollRef = useRef(null);

    const addLog = (msg) => {
        console.log('[BT]', msg);
        setDebugLog(prev => [...prev.slice(-6), msg]);  // keep last 7 lines
    };

    const registerSampleCallback = useCallback((fn) => {
        sampleCallbackRef.current = fn;
    }, []);

    // Poll HR by reading the characteristic manually every 3s.
    // Many Noise / budget watches don't push notifications — they only respond to reads.
    const startHRPolling = useCallback((hrChar) => {
        if (hrPollRef.current) clearInterval(hrPollRef.current);
        addLog('Starting HR poll (3s interval)...');
        hrPollRef.current = setInterval(async () => {
            try {
                if (!deviceRef.current?.gatt?.connected) return;
                const val = await hrChar.readValue();
                const flags = val.getUint8(0);
                const hr = (flags & 0x01) ? val.getUint16(1, true) : val.getUint8(1);
                if (hr > 0) {
                    addLog(`HR polled: ${hr} bpm`);
                    setVitals(v => ({ ...v, hr, source: 'watch' }));
                    sampleCallbackRef.current?.({ type: 'hr', value: hr });
                }
            } catch (e) {
                // Device may have disconnected — stop polling
                clearInterval(hrPollRef.current);
            }
        }, 3000);
    }, []);

    const connect = useCallback(async () => {
        if (!navigator.bluetooth) {
            setError("Web Bluetooth not available. Use Chrome/Edge with the localhost flag enabled. Switching to demo mode.");
            startSimulation();
            return;
        }

        setStatus('connecting');
        setError(null);
        setDebugLog([]);

        try {
            addLog('Opening device picker...');
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: OPTIONAL_SERVICES
            });

            addLog(`Selected: ${device.name || device.id}`);
            setDeviceName(device.name || device.id || 'Unknown Device');
            deviceRef.current = device;

            device.addEventListener('gattserverdisconnected', () => {
                addLog('GATT disconnected');
                clearInterval(hrPollRef.current);
                setConnected(false);
                setStatus('disconnected');
                setVitals(EMPTY_VITALS);
                setDeviceName(null);
            });

            addLog('Connecting to GATT...');
            const server = await device.gatt.connect();
            serverRef.current = server;
            addLog('GATT connected — discovering services...');

            // ── Log ALL services the watch exposes ────────────────────────
            // This tells us exactly what the watch supports without nRF Connect.
            try {
                const allServices = await server.getPrimaryServices();
                const uuids = allServices.map(s => s.uuid);
                addLog(`Services found (${uuids.length}): ${uuids.join(', ')}`);
                console.log('[BT] Full service list:', uuids);
            } catch (e) {
                addLog('Could not enumerate services: ' + e.message);
            }

            // ── Heart Rate — try notifications first, fall back to polling ─
            let hrSubscribed = false;
            try {
                const hrService = await server.getPrimaryService(HEART_RATE_SERVICE);
                const hrChar = await hrService.getCharacteristic(HEART_RATE_MEASUREMENT);
                addLog('HR characteristic found — trying notifications...');

                try {
                    await hrChar.startNotifications();
                    hrChar.addEventListener('characteristicvaluechanged', (e) => {
                        const flags = e.target.value.getUint8(0);
                        const hr = (flags & 0x01)
                            ? e.target.value.getUint16(1, true)
                            : e.target.value.getUint8(1);
                        addLog(`HR notify: ${hr} bpm`);
                        setVitals(v => ({ ...v, hr, source: 'watch' }));
                        sampleCallbackRef.current?.({ type: 'hr', value: hr });
                    });
                    hrSubscribed = true;
                    addLog('HR notifications active');
                } catch {
                    // Watch doesn't support notifications — use polling instead
                    addLog('Notifications unsupported — switching to HR polling');
                    startHRPolling(hrChar);
                    hrSubscribed = true;
                }
            } catch (e) {
                addLog('Heart Rate service not found: ' + e.message);
            }

            if (!hrSubscribed) {
                addLog('WARNING: No HR data source available on this device');
            }

            // ── Battery ────────────────────────────────────────────────────
            try {
                const batService = await server.getPrimaryService(BATTERY_SERVICE);
                const batChar = await batService.getCharacteristic(BATTERY_LEVEL);
                const batVal = await batChar.readValue();
                const battery = batVal.getUint8(0);
                addLog(`Battery: ${battery}%`);
                setVitals(v => ({ ...v, battery, source: 'watch' }));

                try {
                    await batChar.startNotifications();
                    batChar.addEventListener('characteristicvaluechanged', (e) => {
                        setVitals(v => ({ ...v, battery: e.target.value.getUint8(0) }));
                    });
                } catch { /* read-once is fine */ }
            } catch (e) {
                addLog('Battery service not found: ' + e.message);
            }

            // ── Noise proprietary accel (0xFFD0) ──────────────────────────
            try {
                const accelService = await server.getPrimaryService(NOISE_ACCEL_SERVICE);
                const accelChar = await accelService.getCharacteristic(NOISE_ACCEL_CHAR);
                await accelChar.startNotifications();
                accelChar.addEventListener('characteristicvaluechanged', (e) => {
                    const d = e.target.value;
                    const x = d.getInt16(0, true) / 1000;
                    const y = d.getInt16(2, true) / 1000;
                    const z = d.getInt16(4, true) / 1000;
                    sampleCallbackRef.current?.({ type: 'accel', x, y, z });
                });
                addLog('Accel service (0xFFD0) subscribed');
            } catch (e) {
                addLog('Accel 0xFFD0 not available: ' + e.message);
            }

            // ── Noise health service (0xFEE0) — alternative on some models ─
            try {
                const healthService = await server.getPrimaryService(NOISE_HEALTH_SERVICE);
                const healthChar = await healthService.getCharacteristic(NOISE_HEALTH_CHAR);
                await healthChar.startNotifications();
                healthChar.addEventListener('characteristicvaluechanged', (e) => {
                    // Log raw bytes so we can decode the proprietary format
                    const bytes = Array.from(new Uint8Array(e.target.value.buffer));
                    console.log('[BT] 0xFEE0 raw bytes:', bytes);
                    addLog(`0xFEE0 data: [${bytes.slice(0, 8).join(',')}...]`);

                    // Common Noise 0xFEE1 layout (varies by model):
                    // byte[0] = message type (0x01=HR, 0x04=SpO2, 0x05=steps)
                    // byte[1] = value (HR bpm / SpO2 % / steps low byte)
                    if (bytes[0] === 0x01 && bytes[1] > 0) {
                        const hr = bytes[1];
                        addLog(`0xFEE0 HR: ${hr}`);
                        setVitals(v => ({ ...v, hr, source: 'watch' }));
                        sampleCallbackRef.current?.({ type: 'hr', value: hr });
                    } else if (bytes[0] === 0x04 && bytes[1] > 0) {
                        const spo2 = bytes[1];
                        addLog(`0xFEE0 SpO2: ${spo2}`);
                        setVitals(v => ({ ...v, spo2, source: 'watch' }));
                    } else if (bytes[0] === 0x05) {
                        const steps = (bytes[2] << 8) | bytes[1];
                        addLog(`0xFEE0 Steps: ${steps}`);
                        setVitals(v => ({ ...v, steps, source: 'watch' }));
                        sampleCallbackRef.current?.({ type: 'steps', value: steps });
                    }
                });
                addLog('Health service (0xFEE0) subscribed');
            } catch (e) {
                addLog('Health 0xFEE0 not available: ' + e.message);
            }

            setConnected(true);
            setStatus('connected');
            addLog('Setup complete — waiting for data');

        } catch (err) {
            if (err.name === 'NotFoundError') {
                setStatus('disconnected');
                addLog('User cancelled picker');
            } else if (err.name === 'SecurityError') {
                addLog('SecurityError: ' + err.message);
                setError('Security error — a service UUID may be missing from OPTIONAL_SERVICES.');
                setStatus('error');
            } else {
                addLog('Error: ' + err.name + ' ' + err.message);
                setError(err.message);
                setStatus('error');
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Simulation mode ───────────────────────────────────────────────────
    const startSimulation = useCallback(() => {
        if (simulationRef.current) clearInterval(simulationRef.current);
        setStatus('simulating');
        setConnected(true);
        setError(null);

        let simHR = 72, simSpO2 = 98, simSystolic = 122, simDiastolic = 81, simSteps = 1240;

        simulationRef.current = setInterval(() => {
            simHR = Math.min(90, Math.max(65, simHR + (Math.random() - 0.5) * 4));
            simSpO2 = Math.min(100, Math.max(95, simSpO2 + (Math.random() - 0.5) * 0.5));
            simSystolic = Math.min(138, Math.max(112, simSystolic + (Math.random() - 0.5) * 3));
            simDiastolic = Math.min(92, Math.max(72, simDiastolic + (Math.random() - 0.5) * 2));
            simSteps += Math.round(Math.random() * 12);

            const snapshot = {
                hr: Math.round(simHR), spo2: Math.round(simSpO2 * 10) / 10,
                bp: { systolic: Math.round(simSystolic), diastolic: Math.round(simDiastolic) },
                battery: 85, steps: simSteps, source: 'simulation'
            };
            setVitals(snapshot);

            if (sampleCallbackRef.current) {
                const x = (Math.random() - 0.5) * 0.4;
                const y = (Math.random() - 0.5) * 0.4;
                const z = 1.0 + (Math.random() - 0.5) * 0.3;
                sampleCallbackRef.current({ type: 'accel', x, y, z });
                sampleCallbackRef.current({ type: 'hr', value: snapshot.hr });
                sampleCallbackRef.current({ type: 'spo2', value: snapshot.spo2 });
                sampleCallbackRef.current({ type: 'bp', value: snapshot.bp });
                sampleCallbackRef.current({ type: 'steps', value: snapshot.steps });
            }
        }, 1000);
    }, []);

    const disconnect = useCallback(async () => {
        clearInterval(hrPollRef.current);
        if (simulationRef.current) { clearInterval(simulationRef.current); simulationRef.current = null; }
        if (deviceRef.current?.gatt?.connected) deviceRef.current.gatt.disconnect();
        deviceRef.current = null;
        serverRef.current = null;
        setDeviceName(null);
        setConnected(false);
        setStatus('disconnected');
        setVitals(EMPTY_VITALS);
        setDebugLog([]);
    }, []);

    const simulateFall = useCallback(() => {
        if (!sampleCallbackRef.current) return;
        sampleCallbackRef.current({ type: 'accel', x: 2.0, y: 1.5, z: 0.5 });
        setTimeout(() => sampleCallbackRef.current?.({ type: 'accel', x: 0.1, y: 0.1, z: 0.2 }), 300);
    }, []);

    return {
        connected, status, error, vitals, deviceName, debugLog,
        connect, disconnect, simulateFall,
        registerSampleCallback, startSimulation,
        isSimulating: status === 'simulating'
    };
};

export default useBluetooth;