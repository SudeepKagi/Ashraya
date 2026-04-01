// FILE: client/src/components/elder/MedicineVerifier.jsx
import { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import useVoice from '../../hooks/useVoice';
import api from '../../services/api';

const MedicineVerifier = ({ task, prescribedMedicines = [], onComplete, onClose }) => {
    const { speak } = useVoice();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [phase, setPhase] = useState('intro');
    const [scanning, setScanning] = useState(false);
    const [ocrResult, setOcrResult] = useState('');
    const [matchResult, setMatchResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    // Start camera AFTER phase changes to 'camera' so video element is mounted
    useEffect(() => {
        if (phase !== 'camera') return;
        const initCamera = async () => {
            try {
                // Small delay to ensure video element is in DOM
                await new Promise(r => setTimeout(r, 100));
                if (!videoRef.current) {
                    setError('Camera not ready. Please try again.');
                    setPhase('intro');
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: 1280, height: 720 }
                });
                streamRef.current = stream;
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                };
                speak('Point your camera at the medicine strip. Make sure the text is clearly visible.');
            } catch (err) {
                console.error('Camera error:', err);
                setError('Camera not accessible: ' + err.message);
                setPhase('intro');
            }
        };
        initCamera();
    }, [phase]);

    const startCamera = () => {
        setError('');
        setPhase('camera');
    };

    const captureAndScan = async () => {
        if (!videoRef.current || scanning) return;
        setScanning(true);
        setProgress(0);

        try {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

            speak('Scanning medicine. Please hold still.');
            stopCamera();
            setPhase('scanning');

            const worker = await createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                    }
                }
            });

            const { data: { text } } = await worker.recognize(canvas);
            await worker.terminate();

            const extractedText = text.trim().toUpperCase();
            setOcrResult(extractedText);

            const result = checkAgainstPrescription(extractedText, prescribedMedicines);
            setMatchResult(result);
            setPhase('result');

            if (result.matched) {
                speak(`Medicine matched. It is ${result.medicine}. Safe to take.`);
            } else {
                speak('Warning! This medicine does not match your prescription.');
            }
        } catch (err) {
            console.error('OCR error:', err);
            setError('Scanning failed. Try again with better lighting.');
            setScanning(false);
            setPhase('camera');
        }
    };

    const checkAgainstPrescription = (ocrText, medicines) => {
        if (!medicines || medicines.length === 0) {
            return { matched: false, medicine: null, confidence: 0, reason: 'No prescription data found' };
        }
        let bestMatch = null;
        let bestScore = 0;

        for (const med of medicines) {
            const medName = med.name?.toUpperCase() || '';
            if (ocrText.includes(medName)) {
                const score = medName.length / ocrText.length;
                if (score > bestScore) { bestScore = score; bestMatch = med; }
            }
            if (medName.length >= 4) {
                const partial = medName.slice(0, Math.ceil(medName.length * 0.7));
                if (ocrText.includes(partial) && 0.5 > bestScore) {
                    bestScore = 0.5; bestMatch = med;
                }
            }
        }
        return {
            matched: !!bestMatch,
            medicine: bestMatch?.name || null,
            dosage: bestMatch?.dosage || null,
            times: bestMatch?.times || [],
            confidence: Math.round(bestScore * 100),
            reason: bestMatch ? `Matched "${bestMatch.name}" in scanned text` : 'No prescription medicine found in scanned text'
        };
    };

    const handleConfirm = async () => {
        await api.put(`/schedule/task/${task.taskId}`, {
            status: 'done',
            notes: `Medicine verified via OCR. Matched: ${matchResult?.medicine || 'unverified'}`
        });
        speak('Medicine confirmed. Task marked as done.');
        onComplete?.();
        onClose();
    };

    const handleWrongMedicine = async () => {
        speak('Alert sent to your guardian.');
        await api.put(`/schedule/task/${task.taskId}`, {
            status: 'refused',
            refusalReason: 'Wrong medicine detected by OCR scanner'
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
                <div>
                    <p className="text-white font-semibold">Medicine Verifier</p>
                    <p className="text-gray-400 text-xs">{task?.title}</p>
                </div>
                <button onClick={() => { stopCamera(); onClose(); }} className="text-gray-400 hover:text-white text-sm" aria-label="Close">✕ Close</button>
            </div>

            {/* Intro */}
            {phase === 'intro' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="text-6xl mb-6">💊</div>
                    <h2 className="text-white text-2xl font-bold mb-3">Medicine Verification</h2>
                    <p className="text-gray-300 text-sm mb-6">
                        I'll scan your medicine packaging and check it against your prescription to make sure it's the right medicine.
                    </p>
                    <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-4 mb-6 text-left">
                        <p className="text-indigo-400 text-sm font-semibold mb-3">Your prescribed medicines:</p>
                        {prescribedMedicines.length === 0 ? (
                            <p className="text-gray-400 text-sm">No prescription data.</p>
                        ) : (
                            prescribedMedicines.map((m, i) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-700 last:border-0">
                                    <span className="text-white font-medium">{m.name}</span>
                                    <span className="text-gray-400">{m.dosage} · {m.times?.join(', ')}</span>
                                </div>
                            ))
                        )}
                    </div>
                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                    <button
                        onClick={startCamera}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl text-lg transition-colors"
                        aria-label="Start medicine scanner"
                    >
                        📷 Start Scanner
                    </button>
                </div>
            )}

            {/* Camera view */}
            {phase === 'camera' && (
                <div className="flex-1 flex flex-col">
                    <div className="relative flex-1 bg-black">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="border-2 border-indigo-400 border-dashed rounded-2xl w-72 h-36 flex items-center justify-center">
                                <p className="text-indigo-300 text-xs text-center px-4">Position medicine text inside this box</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-900 px-4 py-5 flex gap-3">
                        <button
                            onClick={captureAndScan}
                            disabled={scanning}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
                            aria-label="Scan medicine"
                        >
                            📷 Scan Now
                        </button>
                        <button
                            onClick={() => { stopCamera(); setPhase('intro'); }}
                            className="px-5 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-semibold"
                            aria-label="Go back"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}

            {/* Scanning progress */}
            {phase === 'scanning' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <canvas ref={canvasRef} className="rounded-2xl mb-6 w-full max-w-sm" style={{ maxHeight: 200 }} />
                    <div className="w-full max-w-sm">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>Reading text...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-gray-400 text-xs text-center">Analysing medicine text. Please wait...</p>
                    </div>
                </div>
            )}

            {/* Result */}
            {phase === 'result' && matchResult && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 ${matchResult.matched ? 'bg-emerald-900' : 'bg-red-900'}`}>
                        {matchResult.matched ? '✅' : '⚠️'}
                    </div>
                    <h2 className={`text-2xl font-bold mb-2 ${matchResult.matched ? 'text-emerald-400' : 'text-red-400'}`}>
                        {matchResult.matched ? 'Medicine Verified!' : 'Mismatch Detected!'}
                    </h2>
                    <p className="text-gray-300 text-sm mb-6">{matchResult.reason}</p>
                    <div className="w-full max-w-sm bg-gray-800 rounded-xl p-3 mb-4 text-left">
                        <p className="text-xs text-gray-500 mb-1">Scanned text:</p>
                        <p className="text-gray-300 text-xs font-mono leading-relaxed">
                            {ocrResult.slice(0, 200)}{ocrResult.length > 200 ? '...' : ''}
                        </p>
                    </div>
                    {matchResult.matched && (
                        <div className="w-full max-w-sm bg-emerald-900 rounded-xl p-3 mb-6 text-left">
                            <p className="text-emerald-300 text-sm font-semibold">{matchResult.medicine} {matchResult.dosage}</p>
                            <p className="text-emerald-400 text-xs">Take at: {matchResult.times?.join(', ')}</p>
                        </div>
                    )}
                    <div className="flex gap-3 w-full max-w-sm">
                        {matchResult.matched ? (
                            <button onClick={handleConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl" aria-label="Confirm medicine">
                                ✓ Confirm & Mark Done
                            </button>
                        ) : (
                            <>
                                <button onClick={handleWrongMedicine} className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-2xl text-sm" aria-label="Alert guardian">
                                    Alert Guardian
                                </button>
                                <button onClick={() => { setScanning(false); setPhase('camera'); }} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-2xl text-sm" aria-label="Try again">
                                    Try Again
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MedicineVerifier;