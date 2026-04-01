// FILE: client/src/components/common/SOSButton.jsx
import { useState } from 'react';
import api from '../../services/api';
import useVoice from '../../hooks/useVoice';

const SOSButton = () => {
    const [triggered, setTriggered] = useState(false);
    const [loading, setLoading] = useState(false);
    const { speak } = useVoice();

    const triggerSOS = async () => {
        if (loading) return;
        const confirmed = window.confirm('Send SOS alert to your guardian and emergency contacts?');
        if (!confirmed) return;

        setLoading(true);
        try {
            await api.post('/health/fall-alert', { type: 'manual_sos', confirmedByElder: true });
            setTriggered(true);
            speak('SOS alert sent. Help is on the way.');
            setTimeout(() => setTriggered(false), 10000);
        } catch (err) {
            console.error('SOS failed:', err.message);
            speak('Could not send SOS. Please call your emergency contact directly.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={triggerSOS}
            disabled={loading}
            aria-label="Send SOS emergency alert"
            className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full font-bold text-white shadow-lg transition-all
        ${triggered ? 'bg-orange-500 scale-110' : 'bg-red-600 hover:bg-red-700 active:scale-95'}
        ${loading ? 'opacity-70' : ''}
      `}
        >
            {loading ? '...' : triggered ? '✓' : 'SOS'}
        </button>
    );
};

export default SOSButton;