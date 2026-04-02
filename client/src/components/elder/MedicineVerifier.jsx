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
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    useEffect(() => () => stopCamera(), []);

    useEffect(() => {
        if (phase !== 'camera') return;
        const initCamera = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 100));
                if (!videoRef.current) {
                    setError('Camera is not ready yet. Please try again.');
                    setPhase('intro');
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                streamRef.current = stream;
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => videoRef.current.play();
                speak('Point your camera at the medicine strip and place the label inside the guide box.');
            } catch (err) {
                console.error('Camera error:', err);
                setError(`Camera not accessible: ${err.message}`);
                setPhase('intro');
            }
        };
        initCamera();
    }, [phase, speak]);

    const checkAgainstPrescription = (ocrText, medicines) => {
        if (!medicines || medicines.length === 0) {
            return { matched: false, medicine: null, confidence: 0, reason: 'No prescription data found.' };
        }
        let bestMatch = null;
        let bestScore = 0;
        medicines.forEach((medicine) => {
            const name = medicine.name?.toUpperCase() || '';
            if (!name) return;
            if (ocrText.includes(name)) {
                const score = name.length / Math.max(ocrText.length, 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = medicine;
                }
            }
            if (name.length >= 4) {
                const partial = name.slice(0, Math.ceil(name.length * 0.7));
                if (ocrText.includes(partial) && 0.5 > bestScore) {
                    bestScore = 0.5;
                    bestMatch = medicine;
                }
            }
        });
        return {
            matched: Boolean(bestMatch),
            medicine: bestMatch?.name || null,
            dosage: bestMatch?.dosage || null,
            times: bestMatch?.times || [],
            confidence: Math.round(bestScore * 100),
            reason: bestMatch ? `Matched with ${bestMatch.name}.` : 'This does not match the medicines saved in the elder profile.'
        };
    };

    const startCamera = () => {
        setError('');
        setMatchResult(null);
        setOcrResult('');
        setProgress(0);
        setPhase('camera');
    };

    const captureAndScan = async () => {
        if (!videoRef.current || scanning) return;
        setScanning(true);
        setProgress(0);
        try {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth || 1280;
            canvas.height = videoRef.current.videoHeight || 720;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
            speak('Scanning medicine. Please hold still.');
            stopCamera();
            setPhase('scanning');
            const worker = await createWorker('eng', 1, {
                logger: (message) => {
                    if (message.status === 'recognizing text') {
                        setProgress(Math.round(message.progress * 100));
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
                speak('Warning. This medicine does not match your prescription.');
            }
        } catch (err) {
            console.error('OCR error:', err);
            setError('Scanning failed. Try again with steadier lighting and a clearer angle.');
            setScanning(false);
            setPhase('camera');
        }
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

    const closeVerifier = () => {
        stopCamera();
        onClose();
    };

    return (
        <div className="medicine-modal-shell">
            <div className="medicine-modal">
                <div className="medicine-modal-header">
                    <div>
                        <p className="eyebrow">Medication Safety</p>
                        <h2 className="section-title mt-2">Verify Medicine</h2>
                        <p className="section-subtitle mt-2">{task?.title}</p>
                    </div>
                    <button onClick={closeVerifier} className="header-icon-button" aria-label="Close medicine verifier">×</button>
                </div>
                <div className="medicine-modal-body">
                    <div className="medicine-grid">
                        <aside className="medicine-side-panel">
                            <p className="metric-label">Saved Prescription</p>
                            <h3 className="text-lg font-semibold text-white mt-3">Medicines on file</h3>
                            <p className="section-subtitle mt-2">Ashraya will compare the scanned strip with the elder's saved prescription.</p>
                            <div className="medicine-list">
                                {prescribedMedicines.length === 0 ? (
                                    <div className="medicine-list-item"><div><p className="text-sm font-semibold text-white">No prescription data</p><p className="text-xs muted-text mt-1">Add medicines in the elder profile to enable accurate verification.</p></div></div>
                                ) : (
                                    prescribedMedicines.map((medicine, index) => (
                                        <div key={`${medicine.name}-${index}`} className="medicine-list-item">
                                            <div><p className="text-sm font-semibold text-white">{medicine.name}</p><p className="text-xs muted-text mt-1">{medicine.dosage}</p></div>
                                            <div className="text-right"><p className="text-xs text-white">{medicine.times?.join(', ') || 'No time set'}</p><p className="text-[11px] muted-text mt-1">Scheduled</p></div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="medicine-progress-card">
                                <p className="text-sm font-semibold text-white">How to scan well</p>
                                <ul className="mt-3 space-y-2 text-sm muted-text"><li>Keep the strip flat and steady.</li><li>Bring the printed label inside the guide box.</li><li>Use bright light and avoid glare on the foil.</li></ul>
                            </div>
                        </aside>
                        <section className="medicine-stage">
                            {phase === 'intro' ? (<><p className="metric-label">Step 1</p><h3 className="text-xl font-semibold text-white mt-3">Start the medicine check</h3><p className="section-subtitle mt-2">Open the camera, center the label, and let Ashraya compare it with the stored prescription.</p>{error ? <p className="critical-text text-sm mt-4">{error}</p> : null}<div className="medicine-actions"><button onClick={startCamera} className="header-pill-button" aria-label="Start medicine scanner">Start Scanner</button><button onClick={closeVerifier} className="range-pill" aria-label="Cancel medicine scanner">Cancel</button></div></>) : null}
                            {phase === 'camera' ? (<><p className="metric-label">Step 2</p><h3 className="text-xl font-semibold text-white mt-3">Scan the strip label</h3><p className="section-subtitle mt-2">Place the printed medicine name inside the guide box before scanning.</p><div className="medicine-camera-frame mt-5"><video ref={videoRef} muted playsInline autoPlay /><canvas ref={canvasRef} className="hidden" /><div className="medicine-scan-guide"><div className="medicine-scan-window"><p className="text-sm text-white">Align the medicine name inside this area for the clearest OCR result.</p></div></div></div><div className="medicine-actions"><button onClick={captureAndScan} disabled={scanning} className="header-pill-button" aria-label="Scan medicine now">{scanning ? 'Scanning...' : 'Scan Now'}</button><button onClick={() => { stopCamera(); setPhase('intro'); }} className="range-pill" aria-label="Go back to introduction">Back</button></div></>) : null}
                            {phase === 'scanning' ? (<><p className="metric-label">Step 3</p><h3 className="text-xl font-semibold text-white mt-3">Reading the medicine text</h3><p className="section-subtitle mt-2">Ashraya is extracting the label and checking it against the prescription.</p><div className="medicine-camera-frame mt-5"><canvas ref={canvasRef} className="preview" /></div><div className="medicine-progress-card"><div className="flex items-center justify-between gap-3"><span className="text-sm text-white">OCR progress</span><span className="text-sm text-white">{progress}%</span></div><div className="progress-bar mt-3"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div></div></>) : null}
                            {phase === 'result' && matchResult ? (<><p className="metric-label">Result</p><h3 className="text-xl font-semibold text-white mt-3">{matchResult.matched ? 'Medication verified successfully' : 'Medicine mismatch detected'}</h3><p className="section-subtitle mt-2">{matchResult.reason}</p><div className={`medicine-result-card ${matchResult.matched ? 'success' : 'danger'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white">{matchResult.matched ? matchResult.medicine : 'Prescription did not match'}</p><p className="text-xs muted-text mt-1">Confidence {matchResult.confidence}% {matchResult.matched && matchResult.dosage ? `· ${matchResult.dosage}` : ''}</p></div><span className={`status-badge ${matchResult.matched ? 'status-normal' : 'status-critical'}`}><span className="status-dot" />{matchResult.matched ? 'Match' : 'Mismatch'}</span></div>{matchResult.matched ? <p className="text-sm text-white mt-4">Take at: {matchResult.times?.join(', ') || 'No schedule saved'}</p> : null}<div className="medicine-ocr-block">{ocrResult || 'No OCR result available.'}</div></div><div className="medicine-actions">{matchResult.matched ? <button onClick={handleConfirm} className="header-pill-button" aria-label="Confirm medicine and mark task done">Confirm and Mark Done</button> : <><button onClick={handleWrongMedicine} className="emergency-inline-button" aria-label="Alert guardian about wrong medicine">Alert Guardian</button><button onClick={startCamera} className="range-pill" aria-label="Scan medicine again">Try Again</button></>}</div></>) : null}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedicineVerifier;