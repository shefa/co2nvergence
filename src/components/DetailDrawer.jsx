import React, { useMemo } from 'react';

const DetailDrawer = ({ installation, currentYear, onClose, simulation, personalities }) => {
    if (!installation) return null;

    const { id, s: sector, c: countryCode, e: emissions, p: projections } = installation;
    const isProjected = currentYear > 2024;

    // Basic facts
    const currentEmission = isProjected ? (projections && projections[currentYear - 2025] ? projections[currentYear - 2025] : 0) : emissions[currentYear - 2008];

    // Peak year (combining historical and projections to scale graph correctly)
    const combinedData = [...emissions, ...(projections || Array(6).fill(0))];
    const maxEmission = Math.max(...combinedData);
    const peakYearIndex = emissions.indexOf(Math.max(...emissions));
    const peakYear = 2008 + peakYearIndex;

    // Years reporting
    const yearsReportingCount = emissions.filter(val => val > 0).length;

    // Trend
    const firstNonZeroIndex = emissions.findIndex(val => val > 0);
    const lastNonZeroIndex = emissions.findLastIndex(val => val > 0);

    let trendText = "N/A";
    if (firstNonZeroIndex !== -1 && lastNonZeroIndex !== -1 && firstNonZeroIndex !== lastNonZeroIndex) {
        const firstVal = emissions[firstNonZeroIndex];
        const lastVal = emissions[lastNonZeroIndex];
        if (firstVal > 0) {
            const change = ((lastVal - firstVal) / firstVal) * 100;
            const arrow = change > 0 ? '↑' : '↓';
            trendText = `${arrow} ${Math.abs(change).toFixed(0)}% since ${2008 + firstNonZeroIndex}`;
        }
    }

    // Sparkline data (2008 to 2030 = 23 years)
    const sparklineWidth = 260;
    const sparklineHeight = 60;
    const historicalPoints = [];
    const projectedPoints = [];

    // Plot historical
    emissions.forEach((val, index) => {
        if (val > 0) {
            const x = (index / 22) * sparklineWidth;
            const y = sparklineHeight - ((val / maxEmission) * sparklineHeight); // Invert Y
            historicalPoints.push(`${x},${y}`);

            // Link projected to historical end if relevant
            if (index === 16 && projections && val > 0) {
                projectedPoints.push(`${x},${y}`);
            }
        }
    });

    // Plot projected
    if (projections) {
        projections.forEach((val, index) => {
            if (val > 0) {
                const x = ((17 + index) / 22) * sparklineWidth;
                const y = sparklineHeight - ((val / maxEmission) * sparklineHeight);
                projectedPoints.push(`${x},${y}`);
            }
        });
    }

    const selectedX = ((currentYear - 2008) / 22) * sparklineWidth;
    const dividerX = (16.5 / 22) * sparklineWidth;

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '300px',
            height: '100%',
            backgroundColor: 'var(--surface-dark)',
            borderLeft: '1px solid var(--border-color)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.5)',
            zIndex: 30,
            overflowY: 'auto',
            animation: 'slideInRight 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{id}</h2>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                >
                    &times;
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                <div><strong style={{ color: 'var(--text-primary)' }}>Sector:</strong> {sector}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Country:</strong> {countryCode}</div>
            </div>

            {/* Sparkline Chart */}
            <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Emissions history</h3>
                <svg width={sparklineWidth} height={sparklineHeight} style={{ overflow: 'visible' }}>

                    {/* Divider Now */}
                    <line x1={dividerX} y1="0" x2={dividerX} y2={sparklineHeight} stroke="var(--border-color)" strokeWidth="1" />

                    {/* Highlight line for selected year */}
                    <line x1={selectedX} y1="0" x2={selectedX} y2={sparklineHeight} stroke="var(--border-color)" strokeWidth="2" strokeDasharray="4 4" />

                    {/* Historical Line */}
                    {historicalPoints.length > 0 && (
                        <polyline
                            fill="none"
                            stroke="var(--accent-green)"
                            strokeWidth="2"
                            points={historicalPoints.join(' ')}
                        />
                    )}

                    {/* Projected Line */}
                    {projectedPoints.length > 0 && (
                        <polyline
                            fill="none"
                            stroke="var(--accent-green)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            opacity="0.6"
                            points={projectedPoints.join(' ')}
                        />
                    )}

                    {/* Point for current year if exists */}
                    {currentEmission > 0 && (
                        <circle
                            cx={selectedX}
                            cy={sparklineHeight - ((currentEmission / maxEmission) * sparklineHeight)}
                            r="4"
                            fill={isProjected ? "var(--accent-amber)" : "var(--accent-red)"}
                        />
                    )}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>2008</span>
                    <span>2024</span>
                    <span>2030</span>
                </div>
            </div>

            {/* Simulation Status Block */}
            {currentYear >= 2025 && simulation?.agentStates?.[installation.id] && (() => {
                const agent = simulation.agentStates[installation.id];
                const targetDict = {
                    conservative: [0.35, 0.55, 0.72, 0.90],
                    speculative: [0.15, 0.28, 0.52, 0.72],
                    cautious: [0.20, 0.40, 0.58, 0.78],
                    winding_down: [0.10, 0.20, 0.35, 0.55],
                    inactive: [0.00, 0.00, 0.00, 0.00],
                };
                const target = targetDict[installation.archetype]?.[simulation.currentQuarter - 1] || 0;
                let statusText = <span style={{ color: 'var(--accent-red)', marginLeft: '10px' }}>✗ At risk</span>;
                if (agent.coverageRatio >= target) {
                    statusText = <span style={{ color: 'var(--accent-green)', marginLeft: '10px' }}>✓ On track</span>;
                } else if (agent.coverageRatio >= target * 0.7) {
                    statusText = <span style={{ color: 'var(--accent-amber)', marginLeft: '10px' }}>⚠ Falling behind</span>;
                }

                return (
                    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'var(--bg-dark)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                            Simulation Status
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Archetype</div>
                            <div style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{installation.archetype.replace('_', ' ')}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>Credits held</div>
                            <div>{agent.creditsHeld.toLocaleString()} t</div>

                            <div style={{ color: 'var(--text-secondary)' }}>Coverage ratio</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>{Math.round(agent.coverageRatio * 100)}%</span>
                                <div style={{ flex: 1, height: '8px', backgroundColor: 'black', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min(100, agent.coverageRatio * 100)}%`,
                                        height: '100%',
                                        backgroundColor: agent.coverageRatio >= 0.9 ? 'var(--accent-green)' : (agent.coverageRatio >= 0.6 ? 'var(--accent-amber)' : 'var(--accent-red)')
                                    }}></div>
                                </div>
                            </div>

                            <div style={{ color: 'var(--text-secondary)' }}>Projected annual</div>
                            <div>{agent.projectedAnnual.toLocaleString()} t</div>

                            <div style={{ color: 'var(--text-secondary)' }}>YTD emissions</div>
                            <div>{agent.ytdEmissions.toLocaleString()} t (Q{simulation.currentQuarter})</div>
                        </div>

                        {agent.lastPurchase && (
                            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #333', fontSize: '0.85rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                                    <div style={{ color: 'var(--text-secondary)' }}>Last purchase</div>
                                    <div>Q{agent.lastPurchase.quarter} {agent.lastPurchase.year}</div>

                                    <div style={{ color: 'var(--text-secondary)' }}>Volume</div>
                                    <div>{agent.lastPurchase.volume.toLocaleString()} t</div>

                                    <div style={{ color: 'var(--text-secondary)' }}>Price paid</div>
                                    <div>€{agent.lastPurchase.price.toFixed(2)} / t</div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '15px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            Status: {statusText}
                        </div>
                    </div>
                );
            })()}

            {/* Personality Profile (LLM-tier agents) */}
            {personalities && personalities[installation.id] && (() => {
                const p = personalities[installation.id];
                return (
                    <div style={{
                        padding: '15px',
                        backgroundColor: 'var(--bg-dark)',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--accent-green)',
                    }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                            Personality Profile
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Stability</div>
                                <div style={{ color: 'var(--text-primary)' }}>{p.stability}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Trend</div>
                                <div style={{ color: 'var(--text-primary)' }}>{p.trend}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Shock response</div>
                                <div style={{ color: 'var(--text-primary)' }}>{p.shock_response}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Purchasing style</div>
                                <div style={{ color: 'var(--text-primary)' }}>{p.purchasing_style}</div>
                            </div>
                        </div>
                        <div style={{ marginTop: '10px', fontStyle: 'italic', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
                            "{p.personality_summary}"
                        </div>
                    </div>
                );
            })()}

            {/* Rule-based note for non-LLM agents */}
            {currentYear >= 2025 && !personalities?.[installation.id] && installation.archetype !== 'inactive' && (
                <div style={{
                    padding: '10px 15px',
                    backgroundColor: 'var(--bg-dark)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                }}>
                    Rule-based ({installation.archetype.replace('_', ' ')}) buyer. Deterministic purchasing rules.
                </div>
            )}

            {/* Advanced Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Selected year: {currentYear}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {isProjected && '~'}{currentEmission > 0 ? `${currentEmission.toLocaleString()} t CO₂e` : 'No report this year'}
                        {isProjected && currentEmission > 0 && ' (projected)'}
                    </div>
                </div>

                <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Peak historical year: {peakYear}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {maxEmission > 0 ? `${Math.max(...emissions).toLocaleString()} t CO₂e` : 'No reports'}
                    </div>
                </div>

                <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Years reporting</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {yearsReportingCount} / 17
                    </div>
                </div>

                {/* Projection List Area */}
                {projections && (
                    <div style={{
                        marginTop: '10px',
                        paddingTop: '15px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px'
                    }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '8px' }}>Projection (trend-based)</div>
                        {projections.map((v, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                <span>{2025 + i}</span>
                                <span>~{v.toLocaleString()} t</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', marginTop: '10px' }}>
                            <span>Trend:</span>
                            <span style={{ fontWeight: 'bold', color: trendText.includes('↓') ? 'var(--accent-green)' : (trendText.includes('↑') ? 'var(--accent-red)' : 'var(--text-primary)') }}>
                                {trendText.replace('since 2008', '/ year')}
                            </span>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default DetailDrawer;
