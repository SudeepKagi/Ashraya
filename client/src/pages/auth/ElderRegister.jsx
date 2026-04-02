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
        setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleDisease = (disease) => {
        setForm((prev) => ({
            ...prev,
            diseases: prev.diseases.includes(disease)
                ? prev.diseases.filter((d) => d !== disease)
                : [...prev.diseases, disease]
        }));
    };

    const updateMedicine = (index, field, value) => {
        setForm((prev) => {
            const medicines = [...prev.medicines];
            medicines[index] = { ...medicines[index], [field]: value };
            return { ...prev, medicines };
        });
    };

    const toggleMedicineTime = (index, time) => {
        setForm((prev) => {
            const medicines = [...prev.medicines];
            const times = medicines[index].times.includes(time)
                ? medicines[index].times.filter((t) => t !== time)
                : [...medicines[index].times, time].sort();
            medicines[index] = { ...medicines[index], times };
            return { ...prev, medicines };
        });
    };

    const addMedicine = () => {
        setForm((prev) => ({ ...prev, medicines: [...prev.medicines, emptyMedicine()] }));
    };

    const removeMedicine = (index) => {
        setForm((prev) => ({
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

        const validMedicines = form.medicines.filter((m) => m.name.trim() && m.dosage.trim());

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

    const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none';

    return (
        <div className="auth-shell">
            <div className="w-full max-w-7xl grid lg:grid-cols-[1fr_1.05fr] gap-6 items-start">
                <section className="summary-shell p-8 lg:p-10 sticky top-6">
                    <p className="eyebrow">Elder Onboarding</p>
                    <h1 className="section-title mt-3 text-[2.3rem] leading-tight">Build a personal care profile that powers reminders, wellbeing checks, and guardian support.</h1>
                    <p className="section-subtitle mt-4 max-w-2xl">Tell Ashraya about conditions, medicines, caregivers, and accessibility needs so the assistant can guide each day more safely.</p>
                    <div className="auth-feature-stack mt-8">
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">1</div><span className="status-badge status-normal"><span className="status-dot" />Profile</span></div>
                            <h3 className="text-lg font-semibold text-white">Step 1: Personal Profile</h3>
                            <p className="section-subtitle mt-2">Add identity, language, and guardian contact details so the assistant knows who it is caring for.</p>
                        </article>
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">2</div><span className="status-badge status-warning"><span className="status-dot" />Health</span></div>
                            <h3 className="text-lg font-semibold text-white">Step 2: Health Routine</h3>
                            <p className="section-subtitle mt-2">Capture conditions, medicines, dosage timing, doctor details, and emergency support information.</p>
                        </article>
                        <article className="auth-feature-card">
                            <div className="metric-header"><div className="metric-icon">3</div><span className="status-badge status-normal"><span className="status-dot" />Support</span></div>
                            <h3 className="text-lg font-semibold text-white">Step 3: Accessibility Setup</h3>
                            <p className="section-subtitle mt-2">Tune hearing, vision, mobility, and cognitive support before the first login.</p>
                        </article>
                    </div>
                </section>

                <section className="glass-panel p-8 lg:p-10">
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div>
                            <p className="eyebrow">Registration</p>
                            <h2 className="section-title mt-1">Register as Elder</h2>
                        </div>
                        <div className="chart-tooltip">Step {step} of 3</div>
                    </div>

                    <div className="w-full bg-white/5 rounded-full h-2 mb-6 overflow-hidden">
                        <div className="bg-[var(--accent-teal)] h-2 rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
                    </div>

                    {error ? (
                        <div className="glass-panel p-4 mb-5 text-sm critical-text" role="alert">{error}</div>
                    ) : null}

                    <form onSubmit={handleSubmit} noValidate>
                        {step === 1 ? (
                            <div className="space-y-4">
                                <p className="metric-label">Basic Information</p>
                                <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} className={inputClass} aria-label="Full name" />
                                <div className="grid md:grid-cols-2 gap-3">
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
                                    {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
                                </select>
                                <input name="guardianPhone" placeholder="Guardian's phone (optional)" value={form.guardianPhone} onChange={handleChange} className={inputClass} aria-label="Guardian phone" />
                                <button type="button" onClick={goToStep2} className="header-pill-button w-full justify-center">Next</button>
                            </div>
                        ) : null}

                        {step === 2 ? (
                            <div className="space-y-5">
                                <p className="metric-label">Health Profile</p>
                                <div>
                                    <p className="text-sm text-white mb-3">Select conditions if any:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {DISEASES.map((disease) => (
                                            <button
                                                key={disease}
                                                type="button"
                                                onClick={() => toggleDisease(disease)}
                                                aria-pressed={form.diseases.includes(disease)}
                                                className={`range-pill ${form.diseases.includes(disease) ? 'active' : ''}`}
                                            >
                                                {disease}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-sm text-white">Prescription Medicines</p>
                                    {form.medicines.map((med, idx) => (
                                        <div key={idx} className="glass-panel p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="metric-label">Medicine {idx + 1}</span>
                                                <button type="button" onClick={() => removeMedicine(idx)} className="range-pill" aria-label="Remove medicine">Remove</button>
                                            </div>
                                            <input placeholder="Medicine name" value={med.name} onChange={(e) => updateMedicine(idx, 'name', e.target.value)} className={inputClass} aria-label={`Medicine ${idx + 1} name`} />
                                            <input placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)} className={inputClass} aria-label={`Medicine ${idx + 1} dosage`} />
                                            <div>
                                                <p className="text-xs muted-text mb-2">Select dosage times:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {TIME_OPTIONS.map((time) => (
                                                        <button
                                                            key={time}
                                                            type="button"
                                                            onClick={() => toggleMedicineTime(idx, time)}
                                                            aria-pressed={med.times.includes(time)}
                                                            className={`range-pill ${med.times.includes(time) ? 'active' : ''}`}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addMedicine} className="range-pill active w-full justify-center">Add Another Medicine</button>
                                </div>

                                <input name="ongoingTreatments" placeholder="Ongoing treatments (optional)" value={form.ongoingTreatments} onChange={handleChange} className={inputClass} aria-label="Ongoing treatments" />
                                <input name="doctorName" placeholder="Doctor's name (optional)" value={form.doctorName} onChange={handleChange} className={inputClass} aria-label="Doctor name" />
                                <input name="doctorContact" placeholder="Doctor's phone (optional)" value={form.doctorContact} onChange={handleChange} className={inputClass} aria-label="Doctor contact" />
                                <input name="emergencyContactName" placeholder="Emergency contact name" value={form.emergencyContactName} onChange={handleChange} className={inputClass} aria-label="Emergency contact name" />
                                <input name="emergencyContactPhone" placeholder="Emergency contact phone" value={form.emergencyContactPhone} onChange={handleChange} className={inputClass} aria-label="Emergency contact phone" />

                                <div className="flex gap-3">
                                    <button type="button" onClick={() => { setError(''); setStep(1); }} className="range-pill">Back</button>
                                    <button type="button" onClick={goToStep3} className="header-pill-button">Next</button>
                                </div>
                            </div>
                        ) : null}

                        {step === 3 ? (
                            <div className="space-y-4">
                                <p className="metric-label">Accessibility Needs</p>
                                {[ 
                                    { name: 'hearingImpaired', label: 'Hearing support', desc: 'Prioritize visual confirmations and reminders' },
                                    { name: 'visionImpaired', label: 'Vision support', desc: 'Increase contrast and encourage spoken guidance' },
                                    { name: 'mobilityImpaired', label: 'Mobility support', desc: 'Larger controls and gentler task types' },
                                    { name: 'cognitiveIssues', label: 'Focus support', desc: 'Simplified screens with repeated reminders' }
                                ].map((item) => (
                                    <label key={item.name} className="glass-panel p-4 flex items-start gap-3 cursor-pointer">
                                        <input type="checkbox" name={item.name} checked={form[item.name]} onChange={handleChange} className="mt-1" />
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.label}</p>
                                            <p className="text-xs muted-text mt-1">{item.desc}</p>
                                        </div>
                                    </label>
                                ))}
                                <div className="flex gap-3 mt-2">
                                    <button type="button" onClick={() => { setError(''); setStep(2); }} className="range-pill">Back</button>
                                    <button type="submit" disabled={loading} className="header-pill-button">
                                        {loading ? 'Creating...' : 'Create Account'}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </form>

                    <p className="text-sm muted-text mt-6">
                        Already have an account? <Link to="/login" className="text-[var(--accent-teal)]">Sign In</Link>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default ElderRegister;
