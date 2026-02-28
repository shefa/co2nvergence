import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;

const AgentExplorer = ({ installationsData, personalities, simulation, onSelectInstallation }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [llmOnly, setLlmOnly] = useState(true);
    const [page, setPage] = useState(0);

    const agents = useMemo(() => {
        const rows = [];
        const { agentStates } = simulation;

        for (const inst of installationsData) {
            if (inst.archetype === 'inactive') continue;
            if (llmOnly && !personalities[inst.id]) continue;

            const agent = agentStates[inst.id];
            rows.push({
                inst,
                personality: personalities[inst.id] || null,
                coverage: agent ? agent.coverageRatio : 0,
            });
        }

        // Sort by coverage ascending (most stressed first)
        rows.sort((a, b) => a.coverage - b.coverage);
        return rows;
    }, [installationsData, personalities, simulation.agentStates, llmOnly]);

    const totalPages = Math.ceil(agents.length / PAGE_SIZE);
    const visibleAgents = agents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div style={{
            position: 'absolute',
            top: '340px',
            left: '20px',
            width: '380px',
            maxHeight: 'calc(100% - 360px)',
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontSize: '0.8rem',
            overflow: 'hidden',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
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
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Agent Explorer</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{agents.length} agents</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </div>

            {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Filter bar */}
                    <div style={{ padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={llmOnly}
                                onChange={(e) => { setLlmOnly(e.target.checked); setPage(0); }}
                                style={{ accentColor: 'var(--accent-green)' }}
                            />
                            LLM agents only
                        </label>
                        {totalPages > 1 && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)); }}
                                    disabled={page === 0}
                                    style={{ ...smallBtnStyle, opacity: page === 0 ? 0.3 : 1 }}
                                >&laquo;</button>
                                <span style={{ color: 'var(--text-secondary)' }}>{page + 1}/{totalPages}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(totalPages - 1, p + 1)); }}
                                    disabled={page >= totalPages - 1}
                                    style={{ ...smallBtnStyle, opacity: page >= totalPages - 1 ? 0.3 : 1 }}
                                >&raquo;</button>
                            </div>
                        )}
                    </div>

                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 30px 50px 1fr 55px', gap: '4px', padding: '6px 15px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                        <div>ID</div>
                        <div>CC</div>
                        <div>Sector</div>
                        <div>Personality</div>
                        <div style={{ textAlign: 'right' }}>Cov%</div>
                    </div>

                    {/* Rows */}
                    <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                        {visibleAgents.map(({ inst, personality, coverage }) => (
                            <div
                                key={inst.id}
                                onClick={() => onSelectInstallation(inst)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '100px 30px 50px 1fr 55px',
                                    gap: '4px',
                                    padding: '5px 15px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.id}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>{inst.c}</div>
                                <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.s}</div>
                                <div style={{ color: 'var(--text-secondary)', fontStyle: personality ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {personality ? personality.personality_summary : `(${inst.archetype})`}
                                </div>
                                <div style={{
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    color: coverage >= 0.9 ? 'var(--accent-green)' : coverage >= 0.6 ? 'var(--accent-amber)' : 'var(--accent-red)',
                                }}>
                                    {Math.round(coverage * 100)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const smallBtnStyle = {
    background: 'none',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.75rem',
};

export default AgentExplorer;
