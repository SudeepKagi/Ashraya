// FILE: client/src/components/common/SOSButton.jsx
import { useState } from 'react';
import api from '../../services/api';
import useVoice from '../../hooks/useVoice';
import { useAccessibility } from '../../context/AccessibilityContext';

const SOSButton = () => {
    const [triggered, setTriggered] = useState(false);
    const [loading, setLoading] = useState(false);
    const { speak } = useVoice();
    const { settings } = useAccessibility();

    const triggerSOS = async () => {
        if (loading) return;

        setLoading(true);
        try {
            await api.post('/health/fall-alert', { type: 'manual_sos', confirmedByElder: true });
            setTriggered(true);
            if (!settings.hearingImpaired) {
                speak('SOS alert sent. Help is on the way.');
            }
            window.setTimeout(() => setTriggered(false), 10000);
        } catch (err) {
            console.error('SOS failed:', err.message);
            if (!settings.hearingImpaired) {
                speak('Could not send SOS. Please call your emergency contact directly.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={triggerSOS}
            disabled={loading}
            aria-label="Send SOS emergency alert"
            className={`emergency-button ${settings.mobilityImpaired || settings.hearingImpaired ? 'large' : ''} ${triggered ? 'sent' : ''}`}
        >
            <span className="emergency-button-icon">!</span>
            <span className="emergency-button-copy">
                <span className="emergency-button-label">{loading ? 'Sending...' : triggered ? 'Alert Sent' : 'SOS'}</span>
                <span className="emergency-button-subtitle">{triggered ? 'Guardian notified' : 'Emergency help'}</span>
            </span>
        </button>
    );
};

export default SOSButton;
