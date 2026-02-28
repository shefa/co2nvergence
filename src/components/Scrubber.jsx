import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Loader } from 'lucide-react';
import { runQuarter, runQuarterAsync } from '../utils/simulationEngine';
import { isLLMTier, inferAllPersonalities } from '../utils/personalityInference';
import { tickScenarios, revertScenario } from '../utils/scenarioEngine';

const Scrubber = ({
    currentYear, setCurrentYear,
    simulation, setSimulation,
    installationsData,
    personalities, setPersonalities,
    personalitiesLoading, setPersonalitiesLoading,
    setAgentActivityLog,
    activeScenarios, setActiveScenarios,
}) => {
    const isSimulationMode = currentYear >= 2025;

    // Async processing state
    const [processingQuarter, setProcessingQuarter] = useState(false);
    const [initProgress, setInitProgress] = useState({ done: 0, total: 0, latest: null });

    // Refs for async auto-run
    const cancelledRef = useRef(false);
    const simRef = useRef(simulation);
    simRef.current = simulation;
    const activeScenariosRef = useRef(activeScenarios);
    activeScenariosRef.current = activeScenarios;

    // Initializer logic for when we swap into sim mode
    const resetSimulation = () => {
        cancelledRef.current = true;
        // Clear archetype overrides from installations
        installationsData.forEach(inst => { delete inst.archetypeOverride; });
        setSimulation(prev => {
            const freshAgentStates = {};
            installationsData.forEach(inst => {
                if (inst.archetype !== 'inactive') {
                    freshAgentStates[inst.id] = {
                        creditsHeld: 0,
                        projectedAnnual: inst.p ? inst.p[0] : 0,
                        ytdEmissions: 0,
                        coverageRatio: 0,
                        shortfall: 0,
                        lastPurchase: null,
                    };
                }
            });

            return {
                ...prev,
                running: false,
                currentYear: 2025,
                currentQuarter: 1,
                carbonPrice: 65.0,
                capMultiplier: undefined,
                priceOverride: undefined,
                priceHistory: prev.priceHistory.slice(0, 20),
                agentStates: freshAgentStates
            };
        });
        setCurrentYear(2025);
        setAgentActivityLog([]);
        if (setActiveScenarios) setActiveScenarios([]);
    };

    // Tick active scenarios after each quarter step
    const tickActiveScenariosAfterStep = (resultSim) => {
        const scenarios = activeScenariosRef.current;
        if (!scenarios || scenarios.length === 0 || !setActiveScenarios) return resultSim;

        const { surviving, expired } = tickScenarios(scenarios);
        let sim = resultSim;

        // Revert expired scenarios
        for (const s of expired) {
            sim = revertScenario(s, sim, installationsData);
        }

        setActiveScenarios(surviving);

        if (expired.length > 0) {
            return sim;
        }
        return resultSim;
    };

    const handleStepQuarter = useCallback(async () => {
        const sim = simRef.current;
        if (sim.currentYear > 2030 || (sim.currentYear === 2030 && sim.currentQuarter === 4)) {
            setSimulation(prev => ({ ...prev, running: false }));
            return;
        }

        if (personalities) {
            // Async LLM-driven step
            setProcessingQuarter(true);
            try {
                const result = await runQuarterAsync(
                    sim,
                    installationsData,
                    personalities,
                    (done, total) => {}, // progress within quarter
                    activeScenariosRef.current,
                );
                const tickedSim = tickActiveScenariosAfterStep(result.simulation);
                setSimulation(tickedSim);
                setCurrentYear(tickedSim.currentYear);
                if (result.activityEntries.length > 0) {
                    setAgentActivityLog(prev => [...result.activityEntries, ...prev].slice(0, 50));
                }
            } catch (err) {
                console.error('Async quarter failed, falling back to sync:', err);
                const nextState = runQuarter(sim, installationsData);
                const tickedSim = tickActiveScenariosAfterStep(nextState);
                setSimulation(tickedSim);
                setCurrentYear(tickedSim.currentYear);
            }
            setProcessingQuarter(false);
        } else {
            // Synchronous fallback
            const nextState = runQuarter(sim, installationsData);
            const tickedSim = tickActiveScenariosAfterStep(nextState);
            setSimulation(tickedSim);
            setCurrentYear(tickedSim.currentYear);
        }
    }, [installationsData, personalities, setSimulation, setCurrentYear, setAgentActivityLog, setActiveScenarios]);

    const toggleRun = () => {
        setSimulation(prev => {
            if (prev.running) {
                cancelledRef.current = true;
                return { ...prev, running: false };
            } else {
                if (prev.currentYear > 2030 || (prev.currentYear === 2030 && prev.currentQuarter === 4)) {
                    return prev;
                }
                cancelledRef.current = false;
                return { ...prev, running: true };
            }
        });
    };

    // Recursive async auto-run
    useEffect(() => {
        if (!simulation.running) return;

        let cancelled = false;
        cancelledRef.current = false;

        const step = async () => {
            if (cancelled || cancelledRef.current) return;
            await handleStepQuarter();
            if (!cancelled && !cancelledRef.current) {
                setTimeout(step, personalities ? 200 : 400);
            }
        };

        // Kick off first step after small delay
        const id = setTimeout(step, 100);
        return () => {
            cancelled = true;
            cancelledRef.current = true;
            clearTimeout(id);
        };
    }, [simulation.running, handleStepQuarter, personalities]);

    // Personality initialization handler
    const handleInitAgents = async () => {
        setPersonalitiesLoading(true);
        setInitProgress({ done: 0, total: 0, latest: null });

        const llmInsts = installationsData.filter(isLLMTier);

        try {
            const result = await inferAllPersonalities(llmInsts, (done, total, latest) => {
                setInitProgress({ done, total, latest });
            });

            setPersonalities(result);
            localStorage.setItem('co2nvergence_personalities_v1', JSON.stringify(result));
        } catch (err) {
            console.error('Personality inference failed:', err);
        }

        setPersonalitiesLoading(false);
    };

    const handleResetPersonalities = () => {
        localStorage.removeItem('co2nvergence_personalities_v1');
        setPersonalities(null);
        setAgentActivityLog([]);
    };

    const handleHistoricalScrub = (year) => {
        setCurrentYear(year);
        if (year >= 2025) {
            // Entered simulation territory
        } else {
            if (simulation.running) {
                cancelledRef.current = true;
                setSimulation(prev => ({ ...prev, running: false }));
            }
        }
    };

    // Derived UI states
    const qValue = ((simulation.currentYear - 2025) * 4) + simulation.currentQuarter;
    const maxQs = 24;
    const simProgressPct = isSimulationMode ? ((qValue / maxQs) * 100) : 0;

    const controlsDisabled = processingQuarter || personalitiesLoading;

    return (
        <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
        }}>
            {isSimulationMode ? (
                // SIMULATION MODE CONTROLS
                <>
                    {/* Personality initialization panel */}
                    {personalitiesLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <Loader size={16} className="animate-spin" />
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                Building agent personalities... {initProgress.done} / {initProgress.total || '?'}
                            </span>
                            {initProgress.latest && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{initProgress.latest.personality?.personality_summary || '...'}"
                                </span>
                            )}
                            <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    width: initProgress.total > 0 ? `${(initProgress.done / initProgress.total) * 100}%` : '0%',
                                    height: '100%',
                                    backgroundColor: 'var(--accent-green)',
                                    transition: 'width 0.3s linear'
                                }}></div>
                            </div>
                        </div>
                    ) : !personalities ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {installationsData.filter(isLLMTier).length} LLM-tier agents need personality profiles.
                            </span>
                            <button onClick={handleInitAgents} style={{ ...btnStyle, backgroundColor: 'var(--accent-green)', color: '#000' }}>
                                Initialise Agents
                            </button>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                (or run sim with rule-based fallback)
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={resetSimulation} disabled={controlsDisabled} style={{ ...btnStyle, opacity: controlsDisabled ? 0.5 : 1 }}>
                                    <RotateCcw size={16} /> Reset
                                </button>
                                <button onClick={handleStepQuarter} disabled={controlsDisabled} style={{ ...btnStyle, opacity: controlsDisabled ? 0.5 : 1 }}>
                                    <SkipForward size={16} /> Step
                                </button>
                                <button onClick={toggleRun} disabled={processingQuarter} style={{ ...btnStyle, backgroundColor: simulation.running ? 'var(--accent-amber)' : 'var(--accent-green)', color: '#000', opacity: processingQuarter ? 0.5 : 1 }}>
                                    {simulation.running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Run</>}
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                <span style={{ minWidth: '70px' }}>Q{simulation.currentQuarter} {simulation.currentYear}</span>
                                <span style={{ color: 'var(--accent-green)' }}>€{simulation.carbonPrice.toFixed(2)}/t</span>
                                {processingQuarter && (
                                    <span style={{ color: 'var(--accent-amber)', fontSize: '0.8rem', fontWeight: 'normal' }}>
                                        Processing...
                                    </span>
                                )}
                                {activeScenarios && activeScenarios.length > 0 && (
                                    <span style={{ color: 'var(--accent-amber)', fontSize: '0.8rem', fontWeight: 'normal' }}>
                                        {activeScenarios.length} scenario{activeScenarios.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div style={{ flex: 1, position: 'relative', height: '6px', backgroundColor: 'var(--bg-dark)', borderRadius: '3px', marginLeft: '20px' }}>
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${simProgressPct}%`,
                                    backgroundColor: 'var(--accent-green)',
                                    borderRadius: '3px',
                                    transition: 'width 0.3s linear'
                                }}></div>
                            </div>

                            <button onClick={handleResetPersonalities} style={{ ...btnStyle, fontSize: '0.75rem', padding: '4px 8px', color: 'var(--text-secondary)', border: 'none' }}>
                                Reset Personalities
                            </button>
                        </>
                    )}

                    <button onClick={() => handleHistoricalScrub(2024)} style={{ ...btnStyle, marginLeft: '10px' }}>
                        Exit Sim
                    </button>
                </>
            ) : (
                // HISTORICAL MODE CONTROLS
                <>
                    <button
                        onClick={() => handleHistoricalScrub(currentYear >= 2024 ? 2008 : currentYear + 1)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-dark)'
                        }}
                    >
                        {<Play size={20} />}
                    </button>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>2008</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>2030 (Sim)</span>
                        </div>

                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="range"
                                min="2008"
                                max="2030"
                                step="1"
                                value={currentYear}
                                onChange={(e) => handleHistoricalScrub(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    accentColor: 'var(--accent-green)',
                                    cursor: 'ew-resize',
                                    background: `linear-gradient(to right, var(--text-secondary) ${(2024 - 2008) / (2030 - 2008) * 100}%, transparent ${(2024 - 2008) / (2030 - 2008) * 100}%)`,
                                    backgroundSize: '100% 2px',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    height: '2px'
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontWeight: 'bold'
};

export default Scrubber;
