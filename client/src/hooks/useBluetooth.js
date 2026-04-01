// FILE: client/src/hooks/useBluetooth.js
import { useState, useRef, useCallback } from 'react';

const ACCEL_SERVICE = 'motion_service';
const ACCEL_CHARACTERISTIC = 'accelerometer';

const useBluetooth = () => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('disconnected');
    const [error, setError] = useState(null);
    const deviceRef = useRef(null);
    const sampleCallbackRef = useRef(null);

    const registerSampleCallback = useCallback((fn) => {
        sampleCallbackRef.current = fn;
    }, []);

    const connect = useCallback(async () => {
        if (!navigator.bluetooth) {
            setError('Web Bluetooth not supported. Use Chrome on Android or desktop.');
            setStatus('error');
            return;
        }

        setStatus('connecting');
        setError(null);

        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [ACCEL_SERVICE]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', () => {
                setConnected(false);
                setStatus('disconnected');
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(ACCEL_SERVICE);
            const characteristic = await service.getCharacteristic(ACCEL_CHARACTERISTIC);

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const data = event.target.value;
                const x = data.getFloat32(0, true);
                const y = data.getFloat32(4, true);
                const z = data.getFloat32(8, true);
                if (sampleCallbackRef.current) sampleCallbackRef.current({ x, y, z });
            });

            setConnected(true);
            setStatus('connected');
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (deviceRef.current?.gatt?.connected) {
            deviceRef.current.gatt.disconnect();
        }
        setConnected(false);
        setStatus('disconnected');
    }, []);

    return { connected, status, error, connect, disconnect, registerSampleCallback };
};

export default useBluetooth;