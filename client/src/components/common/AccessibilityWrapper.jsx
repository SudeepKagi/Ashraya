// FILE: client/src/components/common/AccessibilityWrapper.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccessibility } from '../../context/AccessibilityContext';

const CONTROLS = [
    { key: 'largeText', label: 'Large Text', description: 'Bigger text for easier reading' },
    { key: 'highContrast', label: 'High Contrast', description: 'Stronger contrast and clearer outlines' },
    { key: 'audioOnly', label: 'Audio First', description: 'Reduce visual clutter and favor spoken guidance' },
    { key: 'simplifiedUI', label: 'Simple UI', description: 'Calmer layout with fewer distractions' },
    { key: 'hearingImpaired', label: 'Hearing Mode', description: 'Prioritize visual confirmations and reminders' },
    { key: 'visionImpaired', label: 'Vision Mode', description: 'Combine stronger contrast with larger text' },
    { key: 'mobilityImpaired', label: 'Mobility Mode', description: 'Larger touch targets and easier actions' },
    { key: 'cognitiveIssues', label: 'Focus Mode', description: 'Clearer flows with lower friction' }
];

const PRESETS = [
    { label: 'Vision Preset', payload: { visionImpaired: true, largeText: true, highContrast: true, audioOnly: false } },
    { label: 'Hearing Preset', payload: { hearingImpaired: true, simplifiedUI: true } },
    { label: 'Focus Preset', payload: { cognitiveIssues: true, simplifiedUI: true, largeText: true } }
];

const AccessibilityWrapper = ({ children }) => {
    const location = useLocation();
    const { settings, applyProfile, toggleSetting, resetSettings } = useAccessibility();
    const [open, setOpen] = useState(false);
    const activeModes = CONTROLS.filter((control) => settings[control.key]);
    const isElderRoute = location.pathname.startsWith('/elder');
    const isDashboardRoute = location.pathname.startsWith('/elder') || location.pathname.startsWith('/guardian');

    return (
        <>
            {children}

            <button
                onClick={() => setOpen((value) => !value)}
                aria-label="Open accessibility settings"
                className={`accessibility-launcher ${isDashboardRoute ? 'dashboard-position' : ''} ${isElderRoute ? 'elder-position' : ''}`}
            >
                Accessibility
            </button>

            {activeModes.length ? (
                <div className={`accessibility-chip-row ${isDashboardRoute ? 'dashboard-position' : ''} ${isElderRoute ? 'elder-position' : ''}`}>
                    {activeModes.map((mode) => (
                        <span key={mode.key} className="accessibility-chip">
                            {mode.label}
                        </span>
                    ))}
                </div>
            ) : null}

            {open ? (
                <div className="accessibility-overlay">
                    <div className="accessibility-modal">
                        <div className="accessibility-header">
                            <div>
                                <p className="eyebrow">Accessibility</p>
                                <h2 className="section-title mt-2">Adaptive Care Controls</h2>
                                <p className="section-subtitle mt-2">Adjust the interface for hearing, vision, mobility, and cognitive support.</p>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="header-icon-button"
                                aria-label="Close accessibility settings"
                            >
                                ×
                            </button>
                        </div>

                        <div className="accessibility-preset-grid">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => applyProfile(preset.payload)}
                                    className="accessibility-preset"
                                    aria-label={`Apply ${preset.label}`}
                                >
                                    <span className="metric-label">Preset</span>
                                    <span className="text-sm font-semibold text-white mt-2">{preset.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="accessibility-control-list">
                            {CONTROLS.map((control) => (
                                <button
                                    key={control.key}
                                    onClick={() => toggleSetting(control.key)}
                                    aria-pressed={Boolean(settings[control.key])}
                                    className={`accessibility-toggle ${settings[control.key] ? 'active' : ''}`}
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-white">{control.label}</p>
                                        <p className="text-xs muted-text mt-1">{control.description}</p>
                                    </div>
                                    <span className={`accessibility-switch ${settings[control.key] ? 'active' : ''}`}>
                                        <span className="accessibility-switch-thumb" />
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="accessibility-footer">
                            <p className="text-xs muted-text">Changes are saved automatically on this device.</p>
                            <button
                                onClick={resetSettings}
                                className="range-pill"
                                aria-label="Reset accessibility settings"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default AccessibilityWrapper;
