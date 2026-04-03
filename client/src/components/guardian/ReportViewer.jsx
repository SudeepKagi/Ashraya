// FILE: client/src/components/guardian/ReportViewer.jsx
import { useMemo } from 'react';

/* Map report history entries to SVG polyline points.
   viewBox is 300×110, Y-axis: 8 (top) → 98 (bottom) */
const buildPoints = (items, key, maxValue) => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) {
        const v = Number(items[0][key] ?? 0);
        const y = Math.max(8, Math.min(98, 98 - (v / maxValue) * 90));
        return `0,${y} 300,${y}`;
    }
    return items.map((item, i) => {
        const x = (i / (items.length - 1)) * 300;
        const v = Number(item[key] ?? 0);
        const y = Math.max(8, Math.min(98, 98 - (v / maxValue) * 90));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
};

const getSeverityClass = (item = '') => {
    const text = String(item).toLowerCase();
    if (text.includes('fall') || text.includes('critical') || text.includes('sos')) return 'severity-critical';
    if (text.includes('missed') || text.includes('mood') || text.includes('medicine')) return 'severity-warning';
    return 'severity-normal';
};

const getMoodLabel = (score) => {
    if (score == null) return 'No data';
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Attention';
};

const ReportViewer = ({ report, reportHistory, loading, generating, onGenerate, onOpen, open = false, onClose = () => {} }) => {
    // Oldest → newest for the time-series chart
    const historyData = useMemo(() => [...(reportHistory || [])].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    ), [reportHistory]);

    const completionPoints = buildPoints(historyData, 'taskCompletion', 100);
    const moodPoints       = buildPoints(historyData, 'moodScore', 10);

    const hasHistory = historyData.length > 0;

    const recommendations = useMemo(() => {
        if (!report) return [
            'Generate a fresh report to unlock AI caregiving recommendations.',
            'Watch for mood changes and medicine adherence in the next cycle.',
            'Keep reviewing live vitals for unusual spikes.',
        ];
        const items = [];
        if ((report.taskCompletion || 0) < 70)      items.push('Follow up on missed routines and simplify the next schedule window.');
        if ((report.moodScore || 0) < 5)            items.push('Check in with a supportive conversation and consider a family touchpoint today.');
        if ((report.medicineAdherence || 0) < 100)  items.push('Confirm medication supply and refill timing with the elder or pharmacy.');
        if (!items.length)                           items.push('Keep the current care plan steady — today looks stable and on track.');
        return items;
    }, [report]);

    const riskFlags = report?.healthAlerts?.length
        ? report.healthAlerts
        : ['No critical health flags detected in the latest analysis.'];

    const moodLabel = getMoodLabel(report?.moodScore);

    return (
        <aside className={`ai-insights-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
            {/* ── Header ── */}
            <div className="drawer-header">
                <div>
                    <p className="eyebrow">AI Assistant</p>
                    <h2 className="section-title mt-1">AI Analysis</h2>
                    <div className="drawer-badge mt-2">Powered by Groq · Llama 3.3</div>
                </div>
                <button onClick={onClose} className="header-icon-button" aria-label="Close AI insights">×</button>
            </div>

            {/* ── Generate / PDF buttons ── */}
            <div className="drawer-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-heading)' }}>Daily Report</p>
                    <p className="muted-text" style={{ fontSize: '0.72rem', marginTop: 3 }}>
                        {report
                            ? new Date(report.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : 'No report generated yet'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className="header-pill-button"
                        aria-label="Generate daily report"
                    >
                        {generating ? 'Generating…' : 'Generate'}
                    </button>
                    {report?._id ? (
                        <button
                            onClick={() => onOpen(report._id)}
                            className="range-pill active"
                            aria-label="Open report PDF"
                        >
                            PDF
                        </button>
                    ) : null}
                </div>
            </div>

            {/* ── Metrics row when report exists ── */}
            {report && (
                <div className="drawer-section" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                            { label: 'Task Completion', value: `${report.taskCompletion ?? '--'}%`,  color: report.taskCompletion >= 70 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Mood Score',      value: `${report.moodScore ?? '--'}/10`,      color: (report.moodScore ?? 0) >= 6 ? 'var(--green)' : 'var(--amber)' },
                            { label: 'Medicine Adh.',   value: `${report.medicineAdherence ?? '--'}%`, color: (report.medicineAdherence ?? 0) >= 80 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Mood Label',      value: moodLabel,                              color: 'var(--text-body)' },
                        ].map(m => (
                            <div key={m.label} style={{
                                background: 'var(--bg-muted)', borderRadius: 10,
                                padding: '10px 12px', border: '1px solid var(--border)',
                            }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                                <p style={{ fontSize: '1rem', fontWeight: 800, color: m.color, marginTop: 4, lineHeight: 1 }}>{m.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── AI Summary ── */}
            <div className="drawer-section drawer-summary">
                <p className="eyebrow">Summary</p>
                {loading ? (
                    <div style={{ height: 80, borderRadius: 10, background: 'var(--bg-muted)', marginTop: 10, animation: 'pulse-bg 1.5s infinite' }} />
                ) : (
                    <p style={{ fontSize: '0.83rem', lineHeight: 1.7, color: 'var(--text-body)', marginTop: 10 }}>
                        {report?.aiSummary || 'Generate the first report to see a synthesised care summary and highlighted risks.'}
                    </p>
                )}
            </div>

            {/* ── Risk Flags ── */}
            <div className="drawer-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                    <p className="eyebrow">Risk Flags</p>
                    <span className={`severity-tag ${report?.healthAlerts?.length ? 'severity-warning' : 'severity-normal'}`}>
                        {report?.healthAlerts?.length ? 'Watch' : 'Stable'}
                    </span>
                </div>
                <div className="risk-list">
                    {riskFlags.map((item, index) => (
                        <div key={index} className="risk-item" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-muted)', border: '1px solid var(--border)', marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.4 }}>{item}</p>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>Guardian attention marker {index + 1}</p>
                            </div>
                            <span className={`severity-tag ${getSeverityClass(item)}`} style={{ flexShrink: 0 }}>
                                {getSeverityClass(item).replace('severity-', '')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Recommendations ── */}
            <div className="drawer-section">
                <p className="eyebrow mb-3" style={{ marginBottom: 12 }}>Recommendations</p>
                <ol className="recommendation-list">
                    {recommendations.map((item, index) => (
                        <li key={index} style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>{item}</li>
                    ))}
                </ol>
            </div>

            {/* ── Trend Snapshot ── */}
            <div className="drawer-section">
                <p className="eyebrow" style={{ marginBottom: 12 }}>Trend Snapshot</p>
                {!hasHistory ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        No historical data yet. Generate reports on multiple days to see trends.
                    </p>
                ) : (
                    <div style={{ background: 'var(--bg-muted)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
                        <svg
                            viewBox="0 0 300 110"
                            style={{ width: '100%', height: 110, display: 'block', overflow: 'visible' }}
                            aria-label="AI insight trends chart"
                        >
                            {/* Grid lines */}
                            {[20, 45, 70, 95].map(line => (
                                <line
                                    key={line}
                                    x1="0" x2="300" y1={line} y2={line}
                                    stroke="var(--border)" strokeWidth="0.8"
                                />
                            ))}
                            {/* Y-axis labels */}
                            <text x="2" y="13" fontSize="8" fill="var(--text-muted)">100%</text>
                            <text x="2" y="98" fontSize="8" fill="var(--text-muted)">0%</text>

                            {/* Completion line (teal) */}
                            {completionPoints && (
                                <polyline
                                    points={completionPoints}
                                    fill="none"
                                    stroke="var(--teal-deep)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                            {/* Mood line (amber) - scaled to 0-100 range on same axis */}
                            {moodPoints && (
                                <polyline
                                    points={moodPoints}
                                    fill="none"
                                    stroke="var(--amber-container)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="5,3"
                                />
                            )}
                            {/* Data point dots for completion */}
                            {historyData.map((item, i) => {
                                const x = historyData.length === 1 ? 150 : (i / (historyData.length - 1)) * 300;
                                const v = Number(item.taskCompletion ?? 0);
                                const y = Math.max(8, Math.min(98, 98 - (v / 100) * 90));
                                return <circle key={`c-${i}`} cx={x} cy={y} r="3" fill="var(--teal-deep)" />;
                            })}
                            {/* Data point dots for mood */}
                            {historyData.map((item, i) => {
                                const x = historyData.length === 1 ? 150 : (i / (historyData.length - 1)) * 300;
                                const v = Number(item.moodScore ?? 0);
                                const y = Math.max(8, Math.min(98, 98 - (v / 10) * 90));
                                return <circle key={`m-${i}`} cx={x} cy={y} r="3" fill="var(--amber-container)" />;
                            })}
                        </svg>

                        {/* X-axis date labels */}
                        {historyData.length > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                    {new Date(historyData[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                    {new Date(historyData[historyData.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        )}

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--teal-deep)', display: 'inline-block' }} />
                                Completion %
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--amber-container)', display: 'inline-block', borderTop: '2px dashed var(--amber-container)' }} />
                                Mood × 10
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Report History ── */}
            <div className="drawer-section">
                <p className="eyebrow" style={{ marginBottom: 12 }}>Report History</p>
                <div className="history-list">
                    {historyData.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No report history yet.</p>
                    ) : [...historyData].reverse().map(entry => (
                        <div key={entry._id} className="history-item">
                            <div>
                                <p style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                    {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </p>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                    Mood {entry.moodScore ?? '--'}/10 · Tasks {entry.taskCompletion ?? '--'}%
                                </p>
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
                Last analysis: {report
                    ? new Date(report.updatedAt || report.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'not generated yet'}
            </div>
        </aside>
    );
};

export default ReportViewer;
