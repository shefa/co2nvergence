import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const AgentActivity = ({ activityLog, personalities }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const scrollRef = useRef(null);

    // Auto-scroll to top when new entries arrive
    useEffect(() => {
        if (scrollRef.current && isExpanded) {
            scrollRef.current.scrollTop = 0;
        }
    }, [activityLog.length, isExpanded]);

    const recent = activityLog.slice(0, 20);

    return (
        <div style={{
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontSize: '0.8rem',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '10px 15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: 'var(--bg-dark)',
                }}
            >
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Agent Activity</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{recent.length} recent</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </div>

            {isExpanded && (
                <div ref={scrollRef} style={{ maxHeight: '250px', overflowY: 'auto', padding: '8px 0' }}>
                    {recent.map((entry, idx) => {
                        const personality = personalities?.[entry.id];
                        return (
                            <div key={`${entry.id}-${entry.year}-${entry.quarter}-${idx}`} style={{
                                padding: '8px 15px',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{entry.id}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                        {entry.sector} | {entry.country} | Q{entry.quarter} {entry.year}
                                    </span>
                                </div>
                                {personality && (
                                    <div style={{ color: 'var(--accent-green)', fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '3px' }}>
                                        "{personality.personality_summary}"
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                                    <span style={{ color: entry.volume > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        {entry.volume > 0 ? `Bought ${entry.volume.toLocaleString()} t` : 'Held (0 t)'}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)' }}>@ €{entry.price.toFixed(2)}</span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                                    {entry.reasoning}
                                </div>
                            </div>
                        );
                    })}
                    {recent.length === 0 && (
                        <div style={{ padding: '15px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            No LLM decisions yet. Step or run the simulation.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AgentActivity;
