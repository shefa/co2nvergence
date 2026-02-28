import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Trash2 } from 'lucide-react';

const ScenarioLibrary = ({ activeScenarios, scenarioLibrary, onRemoveFromLibrary }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const totalCount = (activeScenarios?.length || 0) + (scenarioLibrary?.length || 0);

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
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} /> Scenarios
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{totalCount} total</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </div>

            {isExpanded && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px 0' }}>
                    {/* Active Scenarios */}
                    {activeScenarios && activeScenarios.length > 0 && (
                        <>
                            <div style={{ padding: '4px 15px', color: 'var(--accent-amber)', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                Active
                            </div>
                            {activeScenarios.map((s) => (
                                <div key={s.id} style={{
                                    padding: '6px 15px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'baseline',
                                }}>
                                    <div>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{s.label}</span>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{s.description}</div>
                                    </div>
                                    <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                        {s.remaining_quarters}Q left
                                    </span>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Saved Scenarios */}
                    {scenarioLibrary && scenarioLibrary.length > 0 && (
                        <>
                            <div style={{ padding: '4px 15px', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginTop: activeScenarios?.length > 0 ? '8px' : 0 }}>
                                History
                            </div>
                            {scenarioLibrary.map((s) => (
                                <div key={s.id} style={{
                                    padding: '6px 15px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <div>
                                        <span style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                            {s.type.replace('_', ' ')} · {s.duration_quarters}Q
                                            {s.appliedAt && ` · Q${s.appliedAt.quarter} ${s.appliedAt.year}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(s.id); }}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                                            cursor: 'pointer', padding: '2px', display: 'flex',
                                        }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}

                    {totalCount === 0 && (
                        <div style={{ padding: '15px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            No scenarios yet. Use the chat to inject scenarios.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScenarioLibrary;
