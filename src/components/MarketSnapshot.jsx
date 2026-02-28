import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const MarketSnapshot = ({ simulation, installationsData }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const { agentStates, currentYear, currentQuarter, lastQuarterDemand, lastQuarterSupply } = simulation;

    // Build a lookup map once for O(1) access instead of O(n) find per agent
    const instMap = useMemo(() => {
        const map = new Map();
        installationsData.forEach(inst => map.set(inst.id, inst));
        return map;
    }, [installationsData]);

    const stats = useMemo(() => {
        if (!agentStates || Object.keys(agentStates).length === 0) return null;

        let archetypeDemand = {
            conservative: 0,
            speculative: 0,
            cautious: 0,
            winding_down: 0
        };

        const sectorCoverage = {};
        const countryCoverage = {};

        // Aggregate stats
        Object.keys(agentStates).forEach(id => {
            const agent = agentStates[id];
            const inst = instMap.get(id);
            if (!inst || inst.archetype === 'inactive') return;

            // Archetype demand mapping using lastPurchase
            if (agent.lastPurchase && agent.lastPurchase.quarter === currentQuarter && agent.lastPurchase.year === currentYear) {
                archetypeDemand[inst.archetype] += agent.lastPurchase.volume;
            }

            // Averages tracking for Sector/Country stress testing
            if (!sectorCoverage[inst.s]) sectorCoverage[inst.s] = { totalCoverage: 0, totalTarget: 0, count: 0 };
            sectorCoverage[inst.s].totalCoverage += agent.creditsHeld;
            sectorCoverage[inst.s].totalTarget += agent.projectedAnnual;
            sectorCoverage[inst.s].count += 1;

            if (!countryCoverage[inst.c]) countryCoverage[inst.c] = { totalCoverage: 0, totalTarget: 0, count: 0 };
            countryCoverage[inst.c].totalCoverage += agent.creditsHeld;
            countryCoverage[inst.c].totalTarget += agent.projectedAnnual;
            countryCoverage[inst.c].count += 1;
        });

        // Find most stressed
        let mostStressedSector = { name: '-', ratio: 1 };
        for (const [s, data] of Object.entries(sectorCoverage)) {
            if (data.totalTarget > 1_000_000) { // arbitrary volume filter so a single tiny spot doesn't dominate
                const r = data.totalCoverage / data.totalTarget;
                if (r < mostStressedSector.ratio) mostStressedSector = { name: s, ratio: r };
            }
        }

        let mostStressedCountry = { name: '-', ratio: 1 };
        for (const [c, data] of Object.entries(countryCoverage)) {
            if (data.totalTarget > 1_000_000) {
                const r = data.totalCoverage / data.totalTarget;
                if (r < mostStressedCountry.ratio) mostStressedCountry = { name: c, ratio: r };
            }
        }

        return { archetypeDemand, mostStressedSector, mostStressedCountry };
    }, [agentStates, currentYear, currentQuarter, installationsData]);

    if (!stats || currentYear < 2025) return null;

    const demandGt = (lastQuarterDemand / 1e9).toFixed(3);
    const supplyGt = (lastQuarterSupply / 1e9).toFixed(3);
    const balanceGt = ((lastQuarterSupply - lastQuarterDemand) / 1e9).toFixed(3);
    const isSurplus = (lastQuarterSupply - lastQuarterDemand) >= 0;

    const maxDemand = Math.max(...Object.values(stats.archetypeDemand), 1); // Avoid div by 0

    return (
        <div style={{
            padding: '0',
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontSize: '0.85rem',
            overflow: 'hidden'
        }}>
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '12px 15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: 'var(--bg-dark)'
                }}
            >
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Market Snapshot</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Q{currentQuarter} {currentYear}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </div>

            {isExpanded && (
                <div style={{ padding: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px', marginBottom: '15px' }}>
                        <div>Total demand</div><div style={{ fontFamily: 'monospace' }}>{demandGt} Gt</div>
                        <div>Total supply</div><div style={{ fontFamily: 'monospace' }}>{supplyGt} Gt</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Net balance</div>
                        <div style={{ fontFamily: 'monospace', color: isSurplus ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {isSurplus ? '+' : ''}{balanceGt} Gt ({isSurplus ? 'surplus' : 'deficit'})
                        </div>
                    </div>

                    <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>By archetype:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                        {['conservative', 'speculative', 'cautious', 'winding_down'].map(arch => {
                            const vol = stats.archetypeDemand[arch] || 0;
                            const volGt = (vol / 1e9).toFixed(3);
                            const pctFilled = (vol / maxDemand) * 100;
                            return (
                                <div key={arch} style={{ display: 'grid', gridTemplateColumns: '90px 60px 1fr', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ textTransform: 'capitalize' }}>{arch.replace('_', ' ')}</div>
                                    <div style={{ fontFamily: 'monospace', textAlign: 'right' }}>{volGt} Gt</div>
                                    <div style={{ height: '8px', backgroundColor: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${pctFilled}%`, height: '100%', backgroundColor: 'var(--accent-amber)' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>Most stressed sector:</div>
                        <div>{stats.mostStressedSector.name} ({(stats.mostStressedSector.ratio * 100).toFixed(0)}% avg coverage)</div>

                        <div style={{ color: 'var(--text-secondary)' }}>Most stressed country:</div>
                        <div>{stats.mostStressedCountry.name} ({(stats.mostStressedCountry.ratio * 100).toFixed(0)}% avg coverage)</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketSnapshot;
