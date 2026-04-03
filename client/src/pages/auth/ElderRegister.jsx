// FILE: client/src/pages/auth/ElderRegister.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DISEASES = [
  'Heart Disease', 'Diabetes', 'Hypertension', 'Cancer',
  'Arthritis', 'Dementia', 'COPD', 'Osteoporosis',
];
const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' }, { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];
const TIME_OPTIONS = [
  '06:00','07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00','19:00',
  '20:00','21:00','22:00',
];

const emptyMedicine = () => ({ name: '', dosage: '', times: [] });

/* ─── shared input style ─── */
const inp = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--border)',
  background: 'var(--bg-muted)',
  color: 'var(--text-heading)',
  fontSize: '0.93rem',
  outline: 'none',
  fontFamily: 'inherit',
};

const STEPS = [
  { num: 1, label: 'Personal Profile', icon: '👤', desc: 'Identity, language & guardian contact.' },
  { num: 2, label: 'Health Routine',   icon: '💊', desc: 'Conditions, medicines & doctor details.' },
  { num: 3, label: 'Accessibility',    icon: '♿', desc: 'Tune hearing, vision & mobility support.' },
];

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
    mobilityImpaired: false, cognitiveIssues: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleDisease = (disease) => setForm((prev) => ({
    ...prev,
    diseases: prev.diseases.includes(disease)
      ? prev.diseases.filter((d) => d !== disease)
      : [...prev.diseases, disease],
  }));

  const updateMedicine = (index, field, value) => setForm((prev) => {
    const medicines = [...prev.medicines];
    medicines[index] = { ...medicines[index], [field]: value };
    return { ...prev, medicines };
  });

  const toggleMedicineTime = (index, time) => setForm((prev) => {
    const medicines = [...prev.medicines];
    const times = medicines[index].times.includes(time)
      ? medicines[index].times.filter((t) => t !== time)
      : [...medicines[index].times, time].sort();
    medicines[index] = { ...medicines[index], times };
    return { ...prev, medicines };
  });

  const addMedicine = () => setForm((prev) => ({ ...prev, medicines: [...prev.medicines, emptyMedicine()] }));

  const removeMedicine = (index) => setForm((prev) => ({
    ...prev,
    medicines: prev.medicines.length === 1
      ? [emptyMedicine()]
      : prev.medicines.filter((_, i) => i !== index),
  }));

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Please enter your full name.';
    if (!form.age || form.age < 50) return 'Please enter a valid age (50+).';
    if (!form.gender) return 'Please select gender.';
    if (!form.phone.trim()) return 'Please enter your phone number.';
    if (!form.email.trim()) return 'Please enter your email address.';
    if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const goToStep2 = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  };
  const goToStep3 = () => { setError(''); setStep(3); };
  const goBack  = (n) => { setError(''); setStep(n); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== 3) return;
    setError('');
    const validMedicines = form.medicines.filter((m) => m.name.trim() && m.dosage.trim());
    try {
      await registerElder({
        name: form.name, age: Number(form.age), gender: form.gender,
        phone: form.phone, email: form.email, password: form.password,
        preferredLanguage: form.preferredLanguage, guardianPhone: form.guardianPhone,
        diseases: form.diseases,
        ongoingTreatments: form.ongoingTreatments ? [form.ongoingTreatments] : [],
        medicines: validMedicines,
        doctorName: form.doctorName, doctorContact: form.doctorContact,
        emergencyContact: { name: form.emergencyContactName, phone: form.emergencyContactPhone },
        accessibility: {
          hearingImpaired: form.hearingImpaired, visionImpaired: form.visionImpaired,
          mobilityImpaired: form.mobilityImpaired, cognitiveIssues: form.cognitiveIssues,
        },
      });
      navigate('/elder');
    } catch (err) {
      setError(err.message);
      setStep(1);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top left, rgba(0,109,109,0.07), transparent 55%), radial-gradient(ellipse at bottom right, rgba(245,158,11,0.06), transparent 55%), var(--bg-cream)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px 48px',
    }}>
      <div style={{
        width: '100%', maxWidth: 960,
        display: 'grid',
        gridTemplateColumns: 'clamp(260px, 38%, 360px) 1fr',
        gap: 24, alignItems: 'start',
      }} className="auth-grid">

        {/* ── Left: Steps sidebar ── */}
        <aside style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: '32px 28px',
          position: 'sticky', top: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 'var(--radius-md)',
              background: 'var(--teal-deep)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700,
            }}>A</div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Ashraya
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--teal-deep)', fontWeight: 600 }}>Elder Registration</p>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Build a care profile that powers daily reminders, wellbeing checks, and guardian support.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: step === s.num ? 'var(--teal-light)' : step > s.num ? 'var(--green-light)' : 'var(--bg-muted)',
                border: `1px solid ${step === s.num ? 'rgba(0,109,109,0.2)' : step > s.num ? 'rgba(5,150,105,0.2)' : 'var(--border)'}`,
                transition: 'background 0.25s',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step === s.num ? 'var(--teal-deep)' : step > s.num ? 'var(--green)' : 'var(--border)',
                  color: step >= s.num ? 'white' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.85rem',
                }}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: step === s.num ? 'var(--teal-deep)' : 'var(--text-heading)' }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--teal-deep)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </aside>

        {/* ── Right: Form ── */}
        <section style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
          padding: '32px 28px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p className="eyebrow">Step {step} of 3</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-heading)', marginTop: 4 }}>
                {STEPS[step - 1].label}
              </h2>
            </div>
            <span style={{ fontSize: '1.5rem' }}>{STEPS[step - 1].icon}</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-muted)', marginBottom: 24, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, var(--teal-deep), var(--teal-mid))',
              width: `${(step / 3) * 100}%`, transition: 'width 0.4s var(--ease-out)',
            }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.87rem' }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* ─ STEP 1: Personal info ─ */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input style={inp} name="name" placeholder="e.g. Kamala Devi" value={form.name} onChange={handleChange} aria-label="Full name" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Age</label>
                    <input style={inp} name="age" type="number" min="50" max="110" placeholder="65" value={form.age} onChange={handleChange} aria-label="Age" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Gender</label>
                    <select style={inp} name="gender" value={form.gender} onChange={handleChange} aria-label="Gender">
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Phone Number</label>
                  <input style={inp} name="phone" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} aria-label="Phone number" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email Address</label>
                  <input style={inp} name="email" type="email" placeholder="you@email.com" value={form.email} onChange={handleChange} aria-label="Email" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
                  <input style={inp} name="password" type="password" placeholder="At least 6 characters" value={form.password} onChange={handleChange} aria-label="Password" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Preferred Language</label>
                  <select style={inp} name="preferredLanguage" value={form.preferredLanguage} onChange={handleChange} aria-label="Preferred language">
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Guardian's Phone (optional)</label>
                  <input style={inp} name="guardianPhone" placeholder="Link to your guardian" value={form.guardianPhone} onChange={handleChange} aria-label="Guardian phone" />
                </div>

                <button type="button" onClick={goToStep2} style={{
                  marginTop: 8, width: '100%', height: 52,
                  borderRadius: 'var(--radius-pill)', background: 'var(--teal-deep)', color: 'white',
                  fontWeight: 700, fontSize: '0.95rem', border: 0, cursor: 'pointer',
                  boxShadow: 'var(--shadow-teal)',
                }}>
                  Next →
                </button>
              </div>
            )}

            {/* ─ STEP 2: Health ─ */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 10 }}>Existing Conditions</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {DISEASES.map((disease) => (
                      <button
                        key={disease} type="button"
                        onClick={() => toggleDisease(disease)}
                        aria-pressed={form.diseases.includes(disease)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-pill)',
                          border: `1.5px solid ${form.diseases.includes(disease) ? 'var(--teal-deep)' : 'var(--border)'}`,
                          background: form.diseases.includes(disease) ? 'var(--teal-light)' : 'var(--bg-muted)',
                          color: form.diseases.includes(disease) ? 'var(--teal-deep)' : 'var(--text-body)',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {disease}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 10 }}>Prescription Medicines</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {form.medicines.map((med, idx) => (
                      <div key={idx} style={{
                        background: 'var(--bg-muted)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)', padding: '16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Medicine {idx + 1}</p>
                          <button type="button" onClick={() => removeMedicine(idx)} style={{
                            padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                            background: 'var(--red-light)', color: 'var(--red)',
                            border: 0, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          }}>Remove</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input style={inp} placeholder="Medicine name" value={med.name} onChange={(e) => updateMedicine(idx, 'name', e.target.value)} aria-label={`Medicine ${idx + 1} name`} />
                          <input style={inp} placeholder="Dosage (e.g. 500mg)" value={med.dosage} onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)} aria-label={`Medicine ${idx + 1} dosage`} />
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 6 }}>Select dosage times:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {TIME_OPTIONS.map((time) => (
                              <button key={time} type="button" onClick={() => toggleMedicineTime(idx, time)} aria-pressed={med.times.includes(time)} style={{
                                padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                                border: `1.5px solid ${med.times.includes(time) ? 'var(--teal-deep)' : 'var(--border)'}`,
                                background: med.times.includes(time) ? 'var(--teal-light)' : 'white',
                                color: med.times.includes(time) ? 'var(--teal-deep)' : 'var(--text-body)',
                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                              }}>{time}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addMedicine} style={{
                      padding: '10px 16px', borderRadius: 'var(--radius-md)',
                      border: '1.5px dashed var(--teal-deep)', background: 'var(--teal-light)',
                      color: 'var(--teal-deep)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    }}>
                      + Add Another Medicine
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input style={inp} name="ongoingTreatments" placeholder="Ongoing treatments (optional)" value={form.ongoingTreatments} onChange={handleChange} aria-label="Ongoing treatments" />
                  <input style={inp} name="doctorName" placeholder="Doctor's name (optional)" value={form.doctorName} onChange={handleChange} aria-label="Doctor name" />
                  <input style={inp} name="doctorContact" placeholder="Doctor's phone (optional)" value={form.doctorContact} onChange={handleChange} aria-label="Doctor contact" />
                  <input style={inp} name="emergencyContactName" placeholder="Emergency contact name" value={form.emergencyContactName} onChange={handleChange} aria-label="Emergency contact name" />
                  <input style={inp} name="emergencyContactPhone" placeholder="Emergency contact phone" value={form.emergencyContactPhone} onChange={handleChange} aria-label="Emergency contact phone" />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => goBack(1)} style={{
                    flex: 1, height: 48, borderRadius: 'var(--radius-pill)',
                    border: '1.5px solid var(--border)', background: 'var(--bg-muted)',
                    color: 'var(--text-body)', fontWeight: 600, cursor: 'pointer',
                  }}>← Back</button>
                  <button type="button" onClick={goToStep3} style={{
                    flex: 2, height: 48, borderRadius: 'var(--radius-pill)',
                    background: 'var(--teal-deep)', color: 'white',
                    border: 0, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-teal)',
                  }}>Next →</button>
                </div>
              </div>
            )}

            {/* ─ STEP 3: Accessibility ─ */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Select any support needs so Ashraya can adapt its interface for you.
                </p>
                {[
                  { name: 'hearingImpaired', label: 'Hearing Support', icon: '🔇', desc: 'Prioritize visual confirmations and text reminders over audio.' },
                  { name: 'visionImpaired', label: 'Vision Support', icon: '👁️', desc: 'Increase contrast and encourage spoken guidance throughout the day.' },
                  { name: 'mobilityImpaired', label: 'Mobility Support', icon: '🦽', desc: 'Larger touch targets and gentler task types for ease of use.' },
                  { name: 'cognitiveIssues', label: 'Focus Support', icon: '🧠', desc: 'Simplified screens and repeated reminders at comfortable intervals.' },
                ].map((item) => (
                  <label key={item.name} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: form[item.name] ? 'var(--teal-light)' : 'var(--bg-muted)',
                    border: `1.5px solid ${form[item.name] ? 'rgba(0,109,109,0.2)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: form[item.name] ? 'var(--teal-deep)' : 'var(--text-heading)' }}>{item.label}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                    <input
                      type="checkbox" name={item.name}
                      checked={form[item.name]} onChange={handleChange}
                      style={{ width: 18, height: 18, accentColor: 'var(--teal-deep)', flexShrink: 0, marginTop: 2 }}
                    />
                  </label>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={() => goBack(2)} style={{
                    flex: 1, height: 52, borderRadius: 'var(--radius-pill)',
                    border: '1.5px solid var(--border)', background: 'var(--bg-muted)',
                    color: 'var(--text-body)', fontWeight: 600, cursor: 'pointer',
                  }}>← Back</button>
                  <button type="submit" disabled={loading} style={{
                    flex: 2, height: 52, borderRadius: 'var(--radius-pill)',
                    background: 'var(--teal-deep)', color: 'white',
                    border: 0, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                    boxShadow: 'var(--shadow-teal)', opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? 'Creating account…' : 'Create My Profile ✓'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default ElderRegister;
