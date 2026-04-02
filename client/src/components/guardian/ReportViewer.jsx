// FILE: client/src/components/guardian/ReportViewer.jsx
import { useMemo } from 'react';

const buildPoints = (items, key, maxValue) => {
    if (!items.length) return '';

    return items.map((item, index) => {
        const x = items.length === 1 ? 140 : (index / (items.length - 1)) * 280;
        const safeValue = Number(item[key] ?? 0);
        const y = 100 - (safeValue / maxValue) * 90;
        return `${x},${Math.max(8, Math.min(92, y))}`;
    }).join(' ');
};

const getSeverityClass = (item = '') => {
    const text = String(item).toLowerCase();
    if (text.includes('fall') || text.includes('critical') || text.includes('sos')) return 'severity-critical';
    if (text.includes('missed') || text.includes('mood') || text.includes('medicine')) return 'severity-warning';
    return 'severity-normal';
};

const ReportViewer = ({ report, reportHistory, loading, generating, onGenerate, onOpen, open = false, onClose = () => {} }) => {
    const historyData = useMemo(() => [...reportHistory].reverse(), [reportHistory]);
    const moodPoints = buildPoints(historyData, 'moodScore', 10);
    const completionPoints = buildPoints(historyData, 'taskCompletion', 100);

    const recommendations = useMemo(() => {
        if (!report) {
            return [
                'Generate a fresh report to unlock AI caregiving recommendations.',
                'Watch for mood changes and medicine adherence in the next cycle.',
                'Keep reviewing live vitals for unusual spikes.'
            ];
        }

        const items = [];
        if ((report.taskCompletion || 0) < 70) items.push('Follow up on missed routines and simplify the next schedule window.');
        if ((report.moodScore || 0) < 5) items.push('Check in with a supportive conversation and consider a family touchpoint today.');
        if ((report.medicineAdherence || 0) < 100) items.push('Confirm medication supply and refill timing with the elder or pharmacy.');
        if (!items.length) items.push('Keep the current care plan steady because today looks stable.');
        return items;
    }, [report]);

    const riskFlags = report?.healthAlerts?.length
        ? report.healthAlerts
        : ['No critical health flags detected in the latest analysis.'];

    return (
        <aside className={`ai-insights-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
            <div className="drawer-header">
                <div>
                    <p className="eyebrow">AI Assistant</p>
                    <h2 className="section-title mt-1">AI Analysis</h2>
                    <div className="drawer-badge mt-2">Powered by Claude</div>
                </div>
                <button onClick={onClose} className="header-icon-button" aria-label="Close AI insights">×</button>
            </div>

            <div className="drawer-section flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">Daily Report</p>
                    <p className="text-xs muted-text mt-1">
                        {report ? new Date(report.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'No report generated yet'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className="header-pill-button"
                        aria-label="Generate daily report"
                    >
                        {generating ? 'Generating...' : 'Generate'}
                    </button>
                    {report?._id ? (
                        <button
                            onClick={() => onOpen(report._id)}
                            className="range-pill active"
                            aria-label="Open report export"
                        >
                            PDF
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="drawer-section drawer-summary">
                <p className="eyebrow">Summary</p>
                {loading ? (
                    <div className="h-24 rounded-2xl bg-white/5 animate-pulse mt-3" />
                ) : (
                    <p className="text-sm leading-7 text-white mt-3">{report?.aiSummary || 'Generate the first report to see a synthesized care summary and highlighted risks.'}</p>
                )}
            </div>

            <div className="drawer-section">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="eyebrow">Risk Flags</p>
                    <span className={`severity-tag ${report?.healthAlerts?.length ? 'severity-warning' : 'severity-normal'}`}>{report?.healthAlerts?.length ? 'Watch' : 'Stable'}</span>
                </div>
                <div className="risk-list">
                    {riskFlags.map((item, index) => (
                        <div key={index} className="risk-item">
                            <div>
                                <p className="text-sm font-semibold text-white">{item}</p>
                                <p className="text-xs muted-text mt-1">Guardian attention marker {index + 1}</p>
                            </div>
                            <span className={`severity-tag ${getSeverityClass(item)}`}>{getSeverityClass(item).replace('severity-', '')}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="drawer-section">
                <p className="eyebrow mb-3">Recommendations</p>
                <ol className="recommendation-list">
                    {recommendations.map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ol>
            </div>

            <div className="drawer-section">
                <p className="eyebrow mb-3">Trend Snapshot</p>
                {historyData.length === 0 ? (
                    <p className="text-sm muted-text">No historical report trend available yet.</p>
                ) : (
                    <div className="chart-surface min-h-0 p-4">
                        <svg viewBox="0 0 300 110" className="w-full h-32" aria-label="AI insight trends">
                            {[20, 45, 70, 95].map((line) => (
                                <line key={line} x1="0" x2="300" y1={line} y2={line} className="chart-grid-line" />
                            ))}
                            <polyline className="chart-line-primary" points={completionPoints} />
                            <polyline className="chart-line-secondary" points={moodPoints} />
                        </svg>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <div className="chart-tooltip"><span className="inline-block w-3 h-3 rounded-full bg-[var(--accent-teal)]" />Completion</div>
                            <div className="chart-tooltip"><span className="inline-block w-3 h-3 rounded-full bg-[var(--accent-amber)]" />Mood</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="drawer-section">
                <p className="eyebrow mb-3">Report History</p>
                <div className="history-list">
                    {historyData.length === 0 ? (
                        <p className="text-sm muted-text">No report history yet.</p>
                    ) : historyData.map((entry) => (
                        <div key={entry._id} className="history-item">
                            <div>
                                <p className="text-sm font-semibold text-white">{new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                <p className="text-xs muted-text mt-1">Mood {entry.moodScore}/10 · Tasks {entry.taskCompletion}%</p>
                            </div>
                            <button
                                onClick={() => onOpen(entry._id)}
                                className="range-pill active"
                                aria-label="Open historical report"
                            >
                                Open
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="drawer-footer">
                Last analysis {report ? new Date(report.updatedAt || report.date).toLocaleString('en-IN') : 'not generated yet'}
            </div>
        </aside>
    );
};

export default ReportViewer;

