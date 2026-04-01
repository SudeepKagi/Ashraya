// FILE: client/src/hooks/useMediaPipe.js
import { useEffect, useRef, useState, useCallback } from 'react';

// Loads MediaPipe Pose via CDN script tags
const loadMediaPipe = () => new Promise((resolve, reject) => {
    if (window.Pose) { resolve(window.Pose); return; }

    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';

    const script3 = document.createElement('script');
    script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    script3.onload = () => setTimeout(() => resolve(window.Pose), 500);
    script3.onerror = reject;

    document.head.appendChild(script1);
    document.head.appendChild(script2);
    document.head.appendChild(script3);
});

const useMediaPipe = ({ onPoseResult, enabled = true } = {}) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const poseRef = useRef(null);
    const cameraRef = useRef(null);
    const [status, setStatus] = useState('idle'); // idle | loading | ready | error
    const [error, setError] = useState('');

    const stop = useCallback(() => {
        if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
        if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
        setStatus('idle');
    }, []);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const init = async () => {
            try {
                setStatus('loading');
                const Pose = await loadMediaPipe();

                if (cancelled) return;

                const pose = new Pose({
                    locateFile: (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
                });

                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                pose.onResults((results) => {
                    if (!canvasRef.current || !videoRef.current) return;

                    const ctx = canvasRef.current.getContext('2d');
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;

                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx.drawImage(results.image, 0, 0);

                    // Draw skeleton if landmarks found
                    if (results.poseLandmarks && window.drawConnectors && window.drawLandmarks) {
                        window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#6366f1', lineWidth: 3 });
                        window.drawLandmarks(ctx, results.poseLandmarks, { color: '#10b981', lineWidth: 2, radius: 4 });
                    }

                    if (onPoseResult) onPoseResult(results.poseLandmarks);
                });

                poseRef.current = pose;

                // Start camera
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

                videoRef.current.srcObject = stream;
                await videoRef.current.play();

                // Feed frames to MediaPipe
                const processFrame = async () => {
                    if (!cancelled && poseRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                        await poseRef.current.send({ image: videoRef.current });
                    }
                    if (!cancelled) requestAnimationFrame(processFrame);
                };
                processFrame();

                setStatus('ready');
            } catch (err) {
                if (!cancelled) {
                    console.error('MediaPipe init error:', err);
                    setError(err.message || 'Camera/MediaPipe failed to load');
                    setStatus('error');
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            stop();
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, [enabled]);

    // Calculate angle between 3 landmarks (degrees)
    const getAngle = useCallback((a, b, c) => {
        if (!a || !b || !c) return null;
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180) / Math.PI);
        if (angle > 180) angle = 360 - angle;
        return Math.round(angle);
    }, []);

    return { videoRef, canvasRef, status, error, getAngle, stop };
};

export default useMediaPipe;