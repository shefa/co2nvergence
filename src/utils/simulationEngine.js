import { ETS_CAP } from './projection';
import { isLLMTier, makeLLMDecision } from './personalityInference';
import { buildScenarioOverrideBlock } from './scenarioEngine';

export function runQuarter(simulation, installations) {
    const { currentYear, currentQuarter, carbonPrice, agentStates } = simulation;

    let totalDemand = 0;
    const newAgentStates = { ...agentStates };

    // Coverage targets by archetype and quarter
    const COVERAGE_TARGETS = {
        conservative: [0.35, 0.55, 0.72, 0.90],
        speculative: [0.15, 0.28, 0.52, 0.72],
        cautious: [0.20, 0.40, 0.58, 0.78],
        winding_down: [0.10, 0.20, 0.35, 0.55],
        inactive: [0.00, 0.00, 0.00, 0.00],
    };

    for (const inst of installations) {
        if (inst.archetype === 'inactive') continue;

        const agent = newAgentStates[inst.id];
        // If agent state wasn't cleanly initialized, skip safety
        if (!agent) continue;

        const qIdx = currentQuarter - 1; // 0-based

        // Accrue quarterly emissions (projected annual / 4 with ±10% noise per installation)
        // Here we use a deterministic pseudo-random modifier so it stays consistent per inst
        const noiseFactor = 0.9 + (Math.abs(Math.sin(parseInt(inst.id.replace(/\D/g, '')) || 1 + currentQuarter)) * 0.2);
        const quarterlyEmissions = Math.round((agent.projectedAnnual / 4) * noiseFactor);
        agent.ytdEmissions += quarterlyEmissions;

        // Skip purchasing if coverage delay is active
        if (agent.purchaseDelayRemaining && agent.purchaseDelayRemaining > 0) {
            agent.purchaseDelayRemaining--;
            agent.coverageRatio = agent.projectedAnnual > 0 ? agent.creditsHeld / agent.projectedAnnual : 0;
            agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
            continue;
        }

        // Determine target coverage for this quarter
        const archetype = inst.archetypeOverride || inst.archetype;
        const targetCoverage = COVERAGE_TARGETS[archetype]?.[qIdx] || COVERAGE_TARGETS[inst.archetype][qIdx];
        const targetCredits = Math.round(agent.projectedAnnual * targetCoverage);
        const purchaseVolume = Math.max(0, targetCredits - agent.creditsHeld);

        if (purchaseVolume > 0) {
            agent.creditsHeld += purchaseVolume;
            agent.lastPurchase = {
                quarter: currentQuarter,
                year: currentYear,
                volume: purchaseVolume,
                price: carbonPrice,
            };
            totalDemand += purchaseVolume;
        }

        agent.coverageRatio = agent.projectedAnnual > 0
            ? agent.creditsHeld / agent.projectedAnnual
            : 0;
        agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
    }

    // Update carbon price based on supply/demand pressure
    const baseCapGt = ETS_CAP[currentYear] || 1.245;
    const annualCapGt = baseCapGt * (simulation.capMultiplier || 1.0);
    const annualCap = annualCapGt * 1e9;
    const quarterlySupply = annualCap / 4;
    const pressureRatio = (totalDemand - quarterlySupply) / quarterlySupply;
    const k = 0.25; // price sensitivity constant
    const newPrice = Math.max(10, Math.min(200, carbonPrice * (1 + k * pressureRatio)));

    // Advance time
    let nextYear = currentYear;
    let nextQuarter = currentQuarter + 1;
    if (nextQuarter > 4) {
        nextQuarter = 1;
        nextYear += 1;
        // Year-end reset: clear YTD emissions, reconcile credits
        for (const id in newAgentStates) {
            newAgentStates[id].ytdEmissions = 0;
            newAgentStates[id].creditsHeld = Math.max(
                0, newAgentStates[id].creditsHeld - newAgentStates[id].projectedAnnual
            );
        }
    }

    const newPriceRecord = { year: currentYear, q: currentQuarter, price: parseFloat(newPrice.toFixed(2)) };

    return {
        ...simulation,
        currentYear: nextYear,
        currentQuarter: nextQuarter,
        carbonPrice: parseFloat(newPrice.toFixed(2)),
        priceHistory: [...simulation.priceHistory, newPriceRecord],
        agentStates: newAgentStates,
        lastQuarterDemand: totalDemand,
        lastQuarterSupply: quarterlySupply,
    };
}

/**
 * Async variant that uses LLM decisions for conservative/speculative agents
 * and rule-based logic for cautious/winding_down agents.
 */
export async function runQuarterAsync(simulation, installations, personalities, onLLMProgress, activeScenarios) {
    const { currentYear, currentQuarter, carbonPrice, agentStates } = simulation;

    let totalDemand = 0;
    const newAgentStates = { ...agentStates };
    const activityEntries = [];

    const COVERAGE_TARGETS = {
        conservative: [0.35, 0.55, 0.72, 0.90],
        speculative: [0.15, 0.28, 0.52, 0.72],
        cautious: [0.20, 0.40, 0.58, 0.78],
        winding_down: [0.10, 0.20, 0.35, 0.55],
        inactive: [0.00, 0.00, 0.00, 0.00],
    };

    const llmAgents = [];
    const ruleAgents = [];

    for (const inst of installations) {
        if (inst.archetype === 'inactive') continue;
        if (!newAgentStates[inst.id]) continue;

        if (isLLMTier(inst) && personalities && personalities[inst.id]) {
            llmAgents.push(inst);
        } else {
            ruleAgents.push(inst);
        }
    }

    // 1. Process rule-based agents synchronously
    for (const inst of ruleAgents) {
        const agent = newAgentStates[inst.id];
        const qIdx = currentQuarter - 1;

        const noiseFactor = 0.9 + (Math.abs(Math.sin(parseInt(inst.id.replace(/\D/g, '')) || 1 + currentQuarter)) * 0.2);
        const quarterlyEmissions = Math.round((agent.projectedAnnual / 4) * noiseFactor);
        agent.ytdEmissions += quarterlyEmissions;

        // Skip purchasing if coverage delay is active
        if (agent.purchaseDelayRemaining && agent.purchaseDelayRemaining > 0) {
            agent.purchaseDelayRemaining--;
            agent.coverageRatio = agent.projectedAnnual > 0 ? agent.creditsHeld / agent.projectedAnnual : 0;
            agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
            continue;
        }

        const archetype = inst.archetypeOverride || inst.archetype;
        const targetCoverage = COVERAGE_TARGETS[archetype]?.[qIdx] || COVERAGE_TARGETS[inst.archetype][qIdx];
        const targetCredits = Math.round(agent.projectedAnnual * targetCoverage);
        const purchaseVolume = Math.max(0, targetCredits - agent.creditsHeld);

        if (purchaseVolume > 0) {
            agent.creditsHeld += purchaseVolume;
            agent.lastPurchase = {
                quarter: currentQuarter,
                year: currentYear,
                volume: purchaseVolume,
                price: carbonPrice,
            };
            totalDemand += purchaseVolume;
        }

        agent.coverageRatio = agent.projectedAnnual > 0 ? agent.creditsHeld / agent.projectedAnnual : 0;
        agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
    }

    // 2. Process LLM-tier agents in batches
    const BATCH_SIZE = 10;
    let llmProcessed = 0;

    for (let i = 0; i < llmAgents.length; i += BATCH_SIZE) {
        const batch = llmAgents.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (inst) => {
                const agent = newAgentStates[inst.id];
                const personality = personalities[inst.id];

                // Accrue emissions first
                const noiseFactor = 0.9 + (Math.abs(Math.sin(parseInt(inst.id.replace(/\D/g, '')) || 1 + currentQuarter)) * 0.2);
                const quarterlyEmissions = Math.round((agent.projectedAnnual / 4) * noiseFactor);
                agent.ytdEmissions += quarterlyEmissions;

                // Skip purchasing if coverage delay is active
                if (agent.purchaseDelayRemaining && agent.purchaseDelayRemaining > 0) {
                    agent.purchaseDelayRemaining--;
                    agent.coverageRatio = agent.projectedAnnual > 0 ? agent.creditsHeld / agent.projectedAnnual : 0;
                    agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
                    return;
                }

                // Build scenario override for this agent's decision prompt
                const scenarioOverride = buildScenarioOverrideBlock(activeScenarios, inst.id);
                const decision = await makeLLMDecision(inst, personality, agent, simulation, scenarioOverride);

                if (decision && decision.success) {
                    // Clamp buy_volume to [0, 2x projectedAnnual]
                    const maxBuy = agent.projectedAnnual * 2;
                    const buyVolume = Math.min(Math.max(0, decision.buy_volume), maxBuy);

                    if (buyVolume > 0) {
                        agent.creditsHeld += buyVolume;
                        agent.lastPurchase = {
                            quarter: currentQuarter,
                            year: currentYear,
                            volume: buyVolume,
                            price: carbonPrice,
                        };
                        totalDemand += buyVolume;
                    }

                    activityEntries.push({
                        id: inst.id,
                        sector: inst.s,
                        country: inst.c,
                        volume: buyVolume,
                        price: carbonPrice,
                        reasoning: decision.reasoning,
                        quarter: currentQuarter,
                        year: currentYear,
                    });
                } else {
                    // Fallback to rule-based
                    const qIdx = currentQuarter - 1;
                    const targetCoverage = COVERAGE_TARGETS[inst.archetype][qIdx];
                    const targetCredits = Math.round(agent.projectedAnnual * targetCoverage);
                    const purchaseVolume = Math.max(0, targetCredits - agent.creditsHeld);

                    if (purchaseVolume > 0) {
                        agent.creditsHeld += purchaseVolume;
                        agent.lastPurchase = {
                            quarter: currentQuarter,
                            year: currentYear,
                            volume: purchaseVolume,
                            price: carbonPrice,
                        };
                        totalDemand += purchaseVolume;
                    }
                }

                agent.coverageRatio = agent.projectedAnnual > 0 ? agent.creditsHeld / agent.projectedAnnual : 0;
                agent.shortfall = Math.max(0, agent.ytdEmissions - agent.creditsHeld);
            })
        );

        llmProcessed = Math.min(i + BATCH_SIZE, llmAgents.length);
        if (onLLMProgress) onLLMProgress(llmProcessed, llmAgents.length);
        await new Promise(r => setTimeout(r, 50));
    }

    // 3. Update carbon price
    const baseCapGtAsync = ETS_CAP[currentYear] || 1.245;
    const annualCapGt = baseCapGtAsync * (simulation.capMultiplier || 1.0);
    const annualCap = annualCapGt * 1e9;
    const quarterlySupply = annualCap / 4;
    const pressureRatio = (totalDemand - quarterlySupply) / quarterlySupply;
    const k = 0.25;
    const newPrice = Math.max(10, Math.min(200, carbonPrice * (1 + k * pressureRatio)));

    // 4. Advance time
    let nextYear = currentYear;
    let nextQuarter = currentQuarter + 1;
    if (nextQuarter > 4) {
        nextQuarter = 1;
        nextYear += 1;
        for (const id in newAgentStates) {
            newAgentStates[id].ytdEmissions = 0;
            newAgentStates[id].creditsHeld = Math.max(
                0, newAgentStates[id].creditsHeld - newAgentStates[id].projectedAnnual
            );
        }
    }

    const newPriceRecord = { year: currentYear, q: currentQuarter, price: parseFloat(newPrice.toFixed(2)) };

    return {
        simulation: {
            ...simulation,
            currentYear: nextYear,
            currentQuarter: nextQuarter,
            carbonPrice: parseFloat(newPrice.toFixed(2)),
            priceHistory: [...simulation.priceHistory, newPriceRecord],
            agentStates: newAgentStates,
            lastQuarterDemand: totalDemand,
            lastQuarterSupply: quarterlySupply,
        },
        activityEntries,
    };
}
