// FILE: client/src/context/AccessibilityContext.jsx
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { useAuth } from './AuthContext';

const AccessibilityContext = createContext(null);

const getSavedSettings = () => {
    try {
        return JSON.parse(localStorage.getItem('ashraya_accessibility_settings')) || {};
    } catch {
        return {};
    }
};

const initialState = {
    hearingImpaired: false,
    visionImpaired: false,
    mobilityImpaired: false,
    cognitiveIssues: false,
    largeText: false,
    highContrast: false,
    audioOnly: false,
    simplifiedUI: false
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'MERGE_SETTINGS':
            return { ...state, ...action.payload };
        case 'TOGGLE_SETTING':
            return { ...state, [action.key]: !state[action.key] };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
};

export const AccessibilityProvider = ({ children }) => {
    const { user } = useAuth();
    const [state, dispatch] = useReducer(reducer, { ...initialState, ...getSavedSettings() });
    const effectiveSettings = useMemo(() => ({
        ...state,
        largeText: state.largeText || state.visionImpaired,
        highContrast: state.highContrast || state.visionImpaired,
        simplifiedUI: state.simplifiedUI || state.cognitiveIssues
    }), [state]);

    useEffect(() => {
        localStorage.setItem('ashraya_accessibility_settings', JSON.stringify(state));
    }, [state]);

    useEffect(() => {
        const body = document.body;
        body.classList.toggle('large-text', effectiveSettings.largeText);
        body.classList.toggle('high-contrast', effectiveSettings.highContrast);
        body.classList.toggle('audio-only', effectiveSettings.audioOnly);
        body.classList.toggle('simplified-ui', effectiveSettings.simplifiedUI);
        body.classList.toggle('hearing-mode', effectiveSettings.hearingImpaired);
        body.classList.toggle('mobility-mode', effectiveSettings.mobilityImpaired);
        body.dataset.audioOnly = String(effectiveSettings.audioOnly);
        body.dataset.simpleUi = String(effectiveSettings.simplifiedUI);
    }, [effectiveSettings]);

    useEffect(() => {
        if (!user?.accessibility) return;

        dispatch({
            type: 'MERGE_SETTINGS',
            payload: {
                hearingImpaired: Boolean(user.accessibility.hearingImpaired),
                visionImpaired: Boolean(user.accessibility.visionImpaired),
                mobilityImpaired: Boolean(user.accessibility.mobilityImpaired),
                cognitiveIssues: Boolean(user.accessibility.cognitiveIssues)
            }
        });
    }, [user]);

    const value = useMemo(() => ({
        settings: effectiveSettings,
        rawSettings: state,
        toggleSetting: (key) => dispatch({ type: 'TOGGLE_SETTING', key }),
        applyProfile: (payload) => dispatch({ type: 'MERGE_SETTINGS', payload }),
        resetSettings: () => dispatch({ type: 'RESET' })
    }), [effectiveSettings, state]);

    return (
        <AccessibilityContext.Provider value={value}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used inside AccessibilityProvider');
    }
    return context;
};
