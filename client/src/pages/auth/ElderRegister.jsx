// FILE: client/src/pages/auth/ElderRegister.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DISEASES = ['Heart Disease', 'Diabetes', 'Hypertension', 'Cancer', 'Arthritis', 'Dementia', 'COPD', 'Osteoporosis'];
const LANGUAGES = [
    { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
    { code: 'kn', label: 'Kannada' }, { code: 'ta', label: 'Tamil' }, { code: 'te', label: 'Telugu' }
];
const TIME_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

const emptyMedicine = () => ({ name: '', dosage: '', times: [] });

const ElderRegister = () => {
    const { registerElder, loading } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        name: '', age: '', gender: '', phone: '', email: '', password: '',
        preferredLanguage: 'en', guardianPhone: '',
        diseases: [],
        medicines: [emptyMedicine()],
        ongoingTreatments: '', doctorName: '', doctorContact: '',
        emergencyContactName: '', emergencyContactPhone: '',
        hearingImpaired: false, visionImpaired: false,
        mobilityImpaired: false, cognitiveIssues: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleDisease = (disease) => {
        setForm(prev => ({
            ...prev,
            diseases: prev.diseases.includes(disease)
                ? prev.diseases.filter(d => d !== disease)
                : [...prev.diseases, disease]
        }));
    };

    // Medicine handlers
    const updateMedicine = (index, field, value) => {
        setForm(prev => {
            const medicines = [...prev.medicines];
            medicines[index] = { ...medicines[index], [field]: value };
            return { ...prev, medicines };
        });
    };

    const toggleMedicineTime = (index, time) => {
        setForm(prev => {
            const medicines = [...prev.medicines];
            const times = medicines[index].times.includes(time)
                ? medicines[index].times.filter(t => t !== time)
                : [...medicines[index].times, time].sort();
            medicines[index] = { ...medicines[index], times };
            return { ...prev, medicines };
        });
    };

    const addMedicine = () => {
        setForm(prev => ({ ...prev, medicines: [...prev.medicines, emptyMedicine()] }));
    };

    const removeMedicine = (index) => {
        setForm(prev => ({
            ...prev,
            medicines: prev.medicines.length === 1
                ? [emptyMedicine()]
                : prev.medicines.filter((_, i) => i !== index)
        }));
    };

    const validateStep1 = () => {
        if (!form.name.trim()) return 'Please enter your full name';
        if (!form.age || form.age < 50) return 'Please enter a valid age (50+)';
        if (!form.gender) return 'Please select gender';
        if (!form.phone.trim()) return 'Please enter phone number';
        if (!form.email.trim()) return 'Please enter email';
        if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters';
        return null;
    };

    const goToStep2 = () => {
        const err = validateStep1();
        if (err) { setError(err); return; }
        setError('');
        setStep(2);
    };

    const goToStep3 = () => { setError(''); setStep(3); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step !== 3) return;
        setError('');

        // Filter out blank medicine rows
        const validMedicines = form.medicines.filter(m => m.name.trim() && m.dosage.trim());

        try {
            await registerElder({
                name: form.name,
                age: Number(form.age),
                gender: form.gender,
                phone: form.phone,
                email: form.email,
                password: form.password,
                preferredLanguage: form.preferredLanguage,
                guardianPhone: form.guardianPhone,
                diseases: form.diseases,
                ongoingTreatments: form.ongoingTreatments ? [form.ongoingTreatments] : [],
                medicines: validMedicines,
                doctorName: form.doctorName,
                doctorContact: form.doctorContact,
                emergencyContact: {
                    name: form.emergencyContactName,
                    phone: form.emergencyContactPhone
                },
                accessibility: {
                    hearingImpaired: form.hearingImpaired,
                    visionImpaired: form.visionImpaired,
                    mobilityImpaired: form.mobilityImpaired,
                    cognitiveIssues: form.cognitiveIssues
                }
            });
            navigate('/elder');
        } catch (err) {
            setError(err.message);
            setStep(1);
        }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-emerald-50 flex items-center justify-center px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">

                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <span className="text-white text-xl font-bold">A</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">Register as Elder</h1>
                    <p className="text-gray-500 text-xs mt-1">Step {step} of 3</p>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
                    <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>

                    {/* ── Step 1: Basic Info ── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-700">Basic Information</h3>
                            <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} className={inputClass} aria-label="Full name" />
                            <div className="grid grid-cols-2 gap-3">
                                <input name="age" type="number" min="50" max="110" placeholder="Age" value={form.age} onChange={handleChange} className={inputClass} aria-label="Age" />
                                <select name="gender" value={form.gender} onChange={handleChange} className={inputClass} aria-label="Gender">
                                    <option value="">Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <input name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} className={inputClass} aria-label="Phone number" />
                            <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={handleChange} className={inputClass} aria-label="Email" />
                            <input name="password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} className={inputClass} aria-label="Password" />
                            <select name="preferredLanguage" value={form.preferredLanguage} onChange={handleChange} className={inputClass} aria-label="Preferred language">
                                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>
                            <input name="guardianPhone" placeholder="Guardian's Phone (optional)" value={form.guardianPhone} onChange={handleChange} className={inputClass} aria-label="Guardian phone" />
                            <button type="button" onClick={goToStep2} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                                Next →
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Health Profile + Medicines ── */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-gray-700">Health Profile</h3>

                            {/* Diseases */}
                            <div>
                                <p className="text-sm text-gray-600 mb-2">Select conditions (if any):</p>
                                <div className="flex flex-wrap gap-2">
                                    {DISEASES.map(d => (
                                        <button key={d} type="button" onClick={() => toggleDisease(d)}
                                            aria-pressed={form.diseases.includes(d)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                                                ${form.diseases.includes(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Medicines */}
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">💊 Prescription Medicines</p>
                                <div className="space-y-4">
                                    {form.medicines.map((med, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-indigo-600">Medicine {idx + 1}</span>
                                                <button type="button" onClick={() => removeMedicine(idx)}
                                                    className="text-xs text-red-400 hover:text-red-600" aria-label="Remove medicine">
                                                    ✕ Remove
                                                </button>
                                            </div>
                                            <input
                                                placeholder="Medicine name (e.g. Metformin)"
                                                value={med.name}
                                                onChange={e => updateMedicine(idx, 'name', e.target.value)}
                                                className={inputClass}
                                                aria-label={`Medicine ${idx + 1} name`}
                                            />
                                            <input
                                                placeholder="Dosage (e.g. 500mg)"
                                                value={med.dosage}
                                                onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                                                className={inputClass}
                                                aria-label={`Medicine ${idx + 1} dosage`}
                                            />
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Dosage times (select all that apply):</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {TIME_OPTIONS.map(t => (
                                                        <button key={t} type="button"
                                                            onClick={() => toggleMedicineTime(idx, t)}
                                                            aria-pressed={med.times.includes(t)}
                                                            className={`px-2 py-1 rounded text-xs border transition-colors
                                                                ${med.times.includes(t) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addMedicine}
                                    className="mt-2 w-full border-2 border-dashed border-indigo-300 text-indigo-600 text-sm py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                                    + Add Another Medicine
                                </button>
                            </div>

                            {/* Doctor & Emergency */}
                            <input name="ongoingTreatments" placeholder="Ongoing treatments (optional)" value={form.ongoingTreatments} onChange={handleChange} className={inputClass} aria-label="Ongoing treatments" />
                            <input name="doctorName" placeholder="Doctor's Name (optional)" value={form.doctorName} onChange={handleChange} className={inputClass} aria-label="Doctor name" />
                            <input name="doctorContact" placeholder="Doctor's Phone (optional)" value={form.doctorContact} onChange={handleChange} className={inputClass} aria-label="Doctor contact" />
                            <input name="emergencyContactName" placeholder="Emergency Contact Name" value={form.emergencyContactName} onChange={handleChange} className={inputClass} aria-label="Emergency contact name" />
                            <input name="emergencyContactPhone" placeholder="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={handleChange} className={inputClass} aria-label="Emergency contact phone" />

                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setError(''); setStep(1); }}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                                    ← Back
                                </button>
                                <button type="button" onClick={goToStep3}
                                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Accessibility ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-700">Accessibility Needs</h3>
                            <p className="text-sm text-gray-500">We'll adapt the app experience based on your needs.</p>
                            {[
                                { name: 'hearingImpaired', label: '🦻 Hearing Impaired', desc: 'Visual alerts instead of audio' },
                                { name: 'visionImpaired', label: '👁️ Vision Impaired', desc: 'High contrast & audio-first UI' },
                                { name: 'mobilityImpaired', label: '🦽 Mobility Impaired', desc: 'Chair exercises, large buttons' },
                                { name: 'cognitiveIssues', label: '🧠 Cognitive Challenges', desc: 'Simplified UI & repeated reminders' }
                            ].map(item => (
                                <label key={item.name}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-indigo-50 transition-colors">
                                    <input type="checkbox" name={item.name} checked={form[item.name]} onChange={handleChange} className="w-4 h-4 text-indigo-600 rounded" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">{item.label}</p>
                                        <p className="text-xs text-gray-500">{item.desc}</p>
                                    </div>
                                </label>
                            ))}
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => { setError(''); setStep(2); }}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                                    ← Back
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                                    {loading ? 'Creating...' : 'Create Account ✓'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default ElderRegister;