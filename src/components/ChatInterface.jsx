import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal } from 'lucide-react';
import ScenarioCard from './ScenarioCard';
import {
    buildIntentClassifierPrompt,
    buildScenarioTranslatorPrompt,
    buildAgentInterrogationPrompt,
    handleAgentInterrogation,
    handleVisualisationIntent,
    applyScenario,
    saveScenarioToLibrary,
} from '../utils/scenarioEngine';

const VLLM_BASE_URL = '/llm/v1';
const MODEL = 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16';

function stripThinking(text) {
    return text.replace(/^[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function callLLM(messages, { max_tokens = 1000, temperature = 0.7 } = {}) {
    const response = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer EMPTY',
        },
        body: JSON.stringify({ model: MODEL, max_tokens, temperature, messages }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return stripThinking(data.choices[0].message.content);
}

function parseJSON(text) {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
}

const ChatInterface = ({
    currentYear, isChatOpen, setIsChatOpen, metrics, simulation,
    setSimulation, installationsData, emissionsData,
    personalities, activeSectors, setActiveSectors,
    activeScenarios, setActiveScenarios,
}) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isChatOpen]);

    // Build simulation context object for intent classifier / translator
    const getSimContext = () => {
        const remainingQ = simulation.currentYear <= 2030
            ? (2030 - simulation.currentYear) * 4 + (4 - simulation.currentQuarter) + 1
            : 0;
        return {
            year: simulation.currentYear,
            quarter: simulation.currentQuarter,
            price: simulation.carbonPrice.toFixed(2),
            remainingQuarters: remainingQ,
        };
    };

    // Build the full data-question system prompt (existing logic)
    const buildDataQuestionSystemPrompt = () => {
        const isProjected = currentYear > 2024;
        const yearLabel = isProjected ? `~${currentYear} (projected)` : `${currentYear} (verified)`;

        let atRiskCount = 0;
        let sectorCoverage = {};
        if (simulation && simulation.agentStates) {
            const instMap = new Map();
            installationsData.forEach(inst => instMap.set(inst.id, inst));

            Object.keys(simulation.agentStates).forEach(id => {
                const agent = simulation.agentStates[id];
                if (agent.coverageRatio < 0.6) atRiskCount++;
                const inst = instMap.get(id);
                if (inst && inst.archetype !== 'inactive') {
                    if (!sectorCoverage[inst.s]) sectorCoverage[inst.s] = { cov: 0, tar: 0 };
                    sectorCoverage[inst.s].cov += agent.creditsHeld;
                    sectorCoverage[inst.s].tar += agent.projectedAnnual;
                }
            });
        }

        let mostAtRiskSector = '-';
        let lowestRatio = 1;
        for (const [s, data] of Object.entries(sectorCoverage)) {
            if (data.tar > 1000000) {
                const r = data.cov / data.tar;
                if (r < lowestRatio) { lowestRatio = r; mostAtRiskSector = s; }
            }
        }

        const simContext = simulation?.running || simulation?.currentYear > 2025 ? `\n
Simulation state:
- Current period: Q${simulation.currentQuarter} ${simulation.currentYear}
- Carbon price: €${simulation.carbonPrice}/t
- Last quarter demand: ${(simulation.lastQuarterDemand / 1e9).toFixed(3)} Gt
- Last quarter supply: ${(simulation.lastQuarterSupply / 1e9).toFixed(3)} Gt
- Most at-risk sector: ${mostAtRiskSector}
- Installations below 60% coverage: ${atRiskCount}
` : '';

        const scenarioSummary = activeScenarios && activeScenarios.length > 0
            ? `\nActive scenarios: ${activeScenarios.map(s => `${s.label} (${s.remaining_quarters}Q remaining)`).join(', ')}`
            : '';

        return `You are a carbon emissions analyst for CO₂nvergence, an EU ETS simulation platform.
Do NOT output any thinking, reasoning, or chain-of-thought. Respond directly and concisely.

You have access to:
1. Verified EU ETS emissions for 15,377 installations from 2008–2024
2. Trend-based baseline projections for 2025–2030 (linear regression on each installation's last 3 reported years)
${simContext}${scenarioSummary}
The user is currently viewing: ${yearLabel}
Total EU emissions shown: ${(metrics?.totalVisible || 0).toLocaleString()} t CO₂e ${isProjected ? '(projected)' : '(verified)'}

Sector breakdown for ${currentYear}: ${JSON.stringify(metrics?.sectorTotals || {})}
Country breakdown for ${currentYear}: ${JSON.stringify(metrics?.countryTotals || {})}

The user can inject scenarios ("what if X?", "simulate Y", "increase Z by N%"), ask about specific agents by ID, or request map visualisation changes.

Important: projections are simple linear trend extrapolations — not econometric forecasts.
When discussing projected values, be clear they are trend-based estimates.
When emissions exceed the ETS cap, flag this as a compliance gap.`;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const simContext = getSimContext();

            // Stage 1: Intent Classification
            let intent = 'data_question';
            try {
                const classifierMessages = buildIntentClassifierPrompt(userMsg, simContext);
                const classifierReply = await callLLM(classifierMessages, { max_tokens: 50, temperature: 0.1 });
                const parsed = parseJSON(classifierReply);
                if (parsed.intent) intent = parsed.intent;
            } catch (e) {
                console.warn('Intent classification failed, defaulting to data_question:', e);
            }

            // Stage 2: Route by intent
            switch (intent) {
                case 'scenario_injection': {
                    const translatorMessages = buildScenarioTranslatorPrompt(userMsg, simContext);
                    const translatorReply = await callLLM(translatorMessages, { max_tokens: 300, temperature: 0.3 });

                    let scenario;
                    try {
                        scenario = parseJSON(translatorReply);
                    } catch {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "I understood you want to inject a scenario, but I couldn't parse the parameters. Try rephrasing, e.g. \"increase German combustion by 15%\" or \"set carbon price to €100\".",
                        }]);
                        break;
                    }

                    if (scenario.type === 'invalid') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `I couldn't translate that into a simulation scenario. ${scenario.reason || ''} Try something like "increase German combustion by 15%" or "delay speculative buyers by 2 quarters".`,
                        }]);
                        break;
                    }

                    // Enrich scenario object
                    scenario.id = crypto.randomUUID();
                    scenario.remaining_quarters = scenario.duration_quarters;
                    scenario.appliedAt = { year: simulation.currentYear, quarter: simulation.currentQuarter };

                    setMessages(prev => [...prev, {
                        role: 'scenario',
                        scenario,
                        status: 'pending',
                    }]);
                    break;
                }

                case 'agent_interrogation': {
                    const result = handleAgentInterrogation(userMsg, installationsData, simulation, personalities);
                    if (result.found) {
                        const interrogationMessages = buildAgentInterrogationPrompt(userMsg, result.contextString);
                        const reply = await callLLM(interrogationMessages, { max_tokens: 500, temperature: 0.5 });
                        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "I couldn't find that installation. Try using an ID like DE_1234 or AT_149. IDs follow the pattern [country code]_[number].",
                        }]);
                    }
                    break;
                }

                case 'visualisation': {
                    const result = handleVisualisationIntent(userMsg);
                    if (result.sectors.length > 0 && setActiveSectors) {
                        setActiveSectors(new Set(result.sectors));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: result.description || `Updated map filters.`,
                        }]);
                    } else if (result.description) {
                        setMessages(prev => [...prev, { role: 'assistant', content: result.description }]);
                    } else {
                        // Couldn't parse — fall through to data question
                        await handleDataQuestion(userMsg);
                    }
                    break;
                }

                case 'run_management': {
                    const lower = userMsg.toLowerCase();
                    if (lower.includes('reset')) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: 'To reset the simulation, use the Reset button in the simulation controls above. This will clear all scenarios and agent states.',
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: 'Run management: you can reset the simulation using the controls above. Branch comparison is coming in a future update.',
                        }]);
                    }
                    break;
                }

                case 'data_question':
                default: {
                    await handleDataQuestion(userMsg);
                    break;
                }
            }
        } catch (error) {
            console.error('Chat Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error communicating with AI: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Existing data question flow (extracted)
    const handleDataQuestion = async (userMsg) => {
        const systemPrompt = buildDataQuestionSystemPrompt();
        const chatMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
        ];
        const reply = await callLLM(chatMessages, { max_tokens: 1000 });
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    };

    // Scenario card actions
    const handleApplyScenario = (scenario) => {
        const { newSimulation, affectedCount } = applyScenario(scenario, simulation, installationsData);
        setSimulation(newSimulation);
        saveScenarioToLibrary(scenario);
        setActiveScenarios(prev => [...prev, scenario]);

        // Update message status
        setMessages(prev => prev.map(m =>
            m.role === 'scenario' && m.scenario?.id === scenario.id
                ? { ...m, status: 'applied' }
                : m
        ));

        // Add confirmation message
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Scenario applied: "${scenario.label}" affecting ${affectedCount.toLocaleString()} installations for ${scenario.duration_quarters} quarters.`,
        }]);
    };

    const handleCancelScenario = (scenarioId) => {
        setMessages(prev => prev.map(m =>
            m.role === 'scenario' && m.scenario?.id === scenarioId
                ? { ...m, status: 'cancelled' }
                : m
        ));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 20px',
        }}>
            {/* Chat History Area */}
            {isChatOpen && (
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingRight: '10px'
                }}>
                    {messages.length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px', fontStyle: 'italic' }}>
                            Ask questions, inject scenarios, or interrogate agents...
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        if (msg.role === 'scenario') {
                            return (
                                <ScenarioCard
                                    key={index}
                                    scenario={msg.scenario}
                                    status={msg.status}
                                    onApply={handleApplyScenario}
                                    onCancel={handleCancelScenario}
                                />
                            );
                        }

                        return (
                            <div
                                key={index}
                                style={{
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    backgroundColor: msg.role === 'user' ? 'var(--top-bar)' : 'var(--bg-dark)',
                                    border: `1px solid ${msg.role === 'user' ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    maxWidth: '80%',
                                    color: 'var(--text-primary)',
                                    animation: 'fadeIn 0.3s ease-in-out'
                                }}
                            >
                                {msg.content}
                            </div>
                        );
                    })}

                    {isLoading && (
                        <div style={{
                            alignSelf: 'flex-start',
                            backgroundColor: 'var(--bg-dark)',
                            border: '1px solid var(--border-color)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Terminal size={14} className="animate-pulse" /> AI is thinking...
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            )}

            {/* Chat Input Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
                <input
                    type="text"
                    placeholder="Ask anything, inject scenarios, or query agents..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsChatOpen(true)}
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '20px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-dark)',
                        color: 'white',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    style={{
                        backgroundColor: input.trim() && !isLoading ? 'var(--accent-green)' : 'var(--border-color)',
                        color: input.trim() && !isLoading ? '#000' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '10px 20px',
                        cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s'
                    }}
                >
                    Send <Send size={16} />
                </button>
            </div>
        </div>
    );
};

export default ChatInterface;
