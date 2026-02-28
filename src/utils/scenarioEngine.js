// ── Intent Classification ──

export function buildIntentClassifierPrompt(userMessage, simContext) {
  return [
    {
      role: 'system',
      content: `You classify user messages for an EU ETS carbon market simulation.
Classify into exactly ONE category:
- scenario_injection: user wants to change simulation parameters (production, carbon price, ETS cap, purchasing behaviour, delays, shutdowns)
- agent_interrogation: user asks about a specific installation by ID (e.g. DE_1234, AT_149) or a named agent
- visualisation: user wants to show/hide/highlight sectors or countries on the map
- run_management: user wants to reset or manage the simulation run
- data_question: general question about emissions data, market state, or analysis

Current simulation: Q${simContext.quarter} ${simContext.year}, price €${simContext.price}/t

Respond JSON only: {"intent": "<category>"}`
    },
    { role: 'user', content: userMessage }
  ];
}

// ── Scenario Translation ──

export function buildScenarioTranslatorPrompt(userMessage, simContext) {
  return [
    {
      role: 'system',
      content: `You translate natural language into structured scenario objects for an EU ETS carbon market simulation.

Available scenario types:
1. production_change: {"multiplier": float} — multiplies projected annual emissions (1.15 = +15%, 0.7 = -30%)
2. coverage_delay: {"delay_quarters": int} — delays credit purchasing by N quarters
3. price_shock: {"price": float} — sets carbon price to this EUR/t value
4. cap_change: {"multiplier": float} — multiplies the annual ETS cap (0.9 = 10% reduction, 1.05 = 5% increase)
5. purchasing_style_override: {"archetype": string} — forces archetype ("conservative"|"speculative"|"cautious"|"winding_down")

Available filters (all optional, combine with AND):
- country: 2-char code from [AT,BE,BG,CY,CZ,DE,DK,EE,ES,FI,FR,GB,GR,HR,HU,IE,IS,IT,LI,LT,LU,LV,MT,NL,NO,PL,PT,RO,SE,SI,SK,XI]
- sector: exact name from [Aluminium,Ammonia,Aviation,Cement,Ceramics,Combustion,Ferrous Metals,Glass,Hydrogen,Lime,Nitric Acid,Non-ferrous,Oil Refining,Other,Paper,Pulp,Soda Ash,Steel]
- archetype: from [conservative,speculative,cautious,winding_down]

Current simulation: Q${simContext.quarter} ${simContext.year}, price €${simContext.price}/t
Remaining quarters to 2030: ${simContext.remainingQuarters}

Respond JSON only:
{"type":"<scenario_type>","params":{...},"filter":{"country":null,"sector":null,"archetype":null},"duration_quarters":<int>,"label":"<short name max 6 words>","description":"<one sentence explaining the effect>"}`
    },
    { role: 'user', content: userMessage }
  ];
}

// ── Agent Interrogation ──

export function buildAgentInterrogationPrompt(userMessage, contextString) {
  return [
    {
      role: 'system',
      content: `You are a carbon market analyst for CO₂nvergence. Answer the user's question about the specific EU ETS installation below. Be concise and reference the agent's personality and actual decision data.
Do NOT output any thinking, reasoning, or chain-of-thought.

${contextString}`
    },
    { role: 'user', content: userMessage }
  ];
}

export function handleAgentInterrogation(userMessage, installationsData, simulation, personalities) {
  const idMatch = userMessage.match(/[A-Z]{2}_\d+/);
  if (!idMatch) return { found: false };

  const id = idMatch[0];
  const inst = installationsData.find(i => i.id === id);
  if (!inst) return { found: false };

  const agent = simulation.agentStates[id];
  if (!agent) return { found: false };

  const personality = personalities?.[id];

  const contextString = `Installation: ${id} (${inst.s}, ${inst.c})
Archetype: ${inst.archetype}
${personality ? `Personality: "${personality.personality_summary}"
Stability: ${personality.stability}
Trend: ${personality.trend}
Shock response: ${personality.shock_response}
Purchasing style: ${personality.purchasing_style}` : 'Rule-based agent (no LLM personality).'}

Current state — Q${simulation.currentQuarter} ${simulation.currentYear}:
- Projected annual emissions: ${agent.projectedAnnual.toLocaleString()} t
- Credits held: ${agent.creditsHeld.toLocaleString()} t (${(agent.coverageRatio * 100).toFixed(1)}% coverage)
- YTD emissions: ${agent.ytdEmissions.toLocaleString()} t
- Shortfall: ${agent.shortfall.toLocaleString()} t
- Last purchase: ${agent.lastPurchase ? `${agent.lastPurchase.volume.toLocaleString()} t @ €${agent.lastPurchase.price.toFixed(2)} in Q${agent.lastPurchase.quarter} ${agent.lastPurchase.year}` : 'None'}
- Carbon price: €${simulation.carbonPrice.toFixed(2)}/t`;

  return { found: true, inst, agent, personality, contextString };
}

// ── Visualisation Intent ──

const COUNTRY_MAP = {
  german: 'DE', germany: 'DE', french: 'FR', france: 'FR',
  polish: 'PL', poland: 'PL', spanish: 'ES', spain: 'ES',
  italian: 'IT', italy: 'IT', dutch: 'NL', netherlands: 'NL',
  czech: 'CZ', greek: 'GR', greece: 'GR', belgian: 'BE',
  belgium: 'BE', swedish: 'SE', sweden: 'SE', finnish: 'FI',
  finland: 'FI', romanian: 'RO', romania: 'RO', austrian: 'AT',
  austria: 'AT', portuguese: 'PT', portugal: 'PT', british: 'GB',
  uk: 'GB', britain: 'GB',
};

const SECTOR_ALIASES = {
  combustion: 'Combustion', cement: 'Cement', ceramics: 'Ceramics',
  aviation: 'Aviation', glass: 'Glass', lime: 'Lime', paper: 'Paper',
  pulp: 'Pulp', steel: 'Steel', aluminium: 'Aluminium', ammonia: 'Ammonia',
  hydrogen: 'Hydrogen', refining: 'Oil Refining', 'oil refining': 'Oil Refining',
  'nitric acid': 'Nitric Acid', 'ferrous metals': 'Ferrous Metals',
  'non-ferrous': 'Non-ferrous', 'soda ash': 'Soda Ash', other: 'Other',
};

export function handleVisualisationIntent(userMessage) {
  const lower = userMessage.toLowerCase();
  let matchedSectors = [];
  let matchedCountries = [];

  for (const [alias, sector] of Object.entries(SECTOR_ALIASES)) {
    if (lower.includes(alias)) matchedSectors.push(sector);
  }

  for (const [alias, code] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(alias)) matchedCountries.push(code);
  }

  const parts = [];
  if (matchedSectors.length > 0) parts.push(matchedSectors.join(', '));
  if (matchedCountries.length > 0) parts.push(`in ${matchedCountries.join(', ')}`);

  return {
    sectors: matchedSectors,
    countries: matchedCountries,
    description: parts.length > 0
      ? `Showing ${parts.join(' ')} installations on the map.`
      : null,
  };
}

// ── Scenario Application ──

export function filterInstallations(installationsData, filter) {
  if (!filter) return installationsData.map(i => i.id);
  return installationsData.filter(inst => {
    if (filter.country && inst.c !== filter.country) return false;
    if (filter.sector && inst.s !== filter.sector) return false;
    if (filter.archetype && inst.archetype !== filter.archetype) return false;
    return true;
  }).map(i => i.id);
}

export function applyScenario(scenario, simulation, installationsData) {
  const affectedIds = new Set(filterInstallations(installationsData, scenario.filter));
  const newAgentStates = {};

  // Deep-copy only affected agents, shallow-copy the rest
  for (const id in simulation.agentStates) {
    if (affectedIds.has(id)) {
      newAgentStates[id] = { ...simulation.agentStates[id] };
    } else {
      newAgentStates[id] = simulation.agentStates[id];
    }
  }

  let newSimulation = { ...simulation, agentStates: newAgentStates };
  const meta = { originalValues: {} };

  switch (scenario.type) {
    case 'production_change': {
      const multiplier = scenario.params.multiplier;
      for (const id of affectedIds) {
        if (newAgentStates[id]) {
          meta.originalValues[id] = newAgentStates[id].projectedAnnual;
          newAgentStates[id].projectedAnnual = Math.round(
            newAgentStates[id].projectedAnnual * multiplier
          );
          newAgentStates[id].activeScenario = scenario;
        }
      }
      break;
    }
    case 'price_shock': {
      meta.originalValues._carbonPrice = simulation.carbonPrice;
      newSimulation.carbonPrice = scenario.params.price;
      newSimulation.priceOverride = {
        value: scenario.params.price,
        remainingQuarters: scenario.duration_quarters,
      };
      break;
    }
    case 'cap_change': {
      meta.originalValues._capMultiplier = simulation.capMultiplier || 1.0;
      newSimulation.capMultiplier = scenario.params.multiplier;
      break;
    }
    case 'coverage_delay': {
      for (const id of affectedIds) {
        if (newAgentStates[id]) {
          newAgentStates[id].purchaseDelayRemaining = scenario.params.delay_quarters;
          newAgentStates[id].activeScenario = scenario;
        }
      }
      break;
    }
    case 'purchasing_style_override': {
      const targetArchetype = scenario.params.archetype;
      for (const inst of installationsData) {
        if (affectedIds.has(inst.id)) {
          meta.originalValues[inst.id] = inst.archetype;
          inst.archetypeOverride = targetArchetype;
        }
      }
      break;
    }
  }

  scenario.meta = meta;
  return { newSimulation, affectedCount: affectedIds.size };
}

export function revertScenario(scenario, simulation, installationsData) {
  const newAgentStates = { ...simulation.agentStates };
  let newSimulation = { ...simulation, agentStates: newAgentStates };

  switch (scenario.type) {
    case 'production_change': {
      for (const [id, originalVal] of Object.entries(scenario.meta?.originalValues || {})) {
        if (newAgentStates[id]) {
          newAgentStates[id] = { ...newAgentStates[id] };
          newAgentStates[id].projectedAnnual = originalVal;
          delete newAgentStates[id].activeScenario;
        }
      }
      break;
    }
    case 'price_shock': {
      delete newSimulation.priceOverride;
      break;
    }
    case 'cap_change': {
      newSimulation.capMultiplier = scenario.meta?.originalValues?._capMultiplier || 1.0;
      break;
    }
    case 'coverage_delay': {
      for (const id in newAgentStates) {
        if (newAgentStates[id]?.activeScenario?.id === scenario.id) {
          newAgentStates[id] = { ...newAgentStates[id] };
          delete newAgentStates[id].purchaseDelayRemaining;
          delete newAgentStates[id].activeScenario;
        }
      }
      break;
    }
    case 'purchasing_style_override': {
      for (const inst of installationsData) {
        if (scenario.meta?.originalValues?.[inst.id]) {
          delete inst.archetypeOverride;
        }
      }
      break;
    }
  }

  return newSimulation;
}

export function tickScenarios(activeScenarios) {
  const updated = activeScenarios.map(s => ({
    ...s,
    remaining_quarters: s.remaining_quarters - 1,
  }));
  return {
    surviving: updated.filter(s => s.remaining_quarters > 0),
    expired: updated.filter(s => s.remaining_quarters <= 0),
  };
}

// ── Scenario Override for LLM Decision Prompts ──

export function buildScenarioOverrideBlock(activeScenarios, instId) {
  if (!activeScenarios || activeScenarios.length === 0) return '';

  const relevant = activeScenarios.filter(s => {
    if (!s.meta?.originalValues) return false;
    if (s.type === 'price_shock' || s.type === 'cap_change') return true;
    return s.meta.originalValues[instId] !== undefined;
  });

  if (relevant.length === 0) return '';

  const lines = relevant.map(s =>
    `- ${s.label}: ${s.description} (${s.remaining_quarters} quarters remaining)`
  );

  return `\nSCENARIO OVERRIDE ACTIVE:
${lines.join('\n')}
Factor these overrides into your purchasing decision. Your personality and history still apply, but you must account for these changed conditions.`;
}

// ── Scenario Library (localStorage) ──

const LIBRARY_KEY = 'co2nvergence_scenario_library_v1';

export function saveScenarioToLibrary(scenario) {
  const library = loadScenarioLibrary();
  library.unshift({
    id: scenario.id,
    type: scenario.type,
    params: scenario.params,
    filter: scenario.filter,
    duration_quarters: scenario.duration_quarters,
    label: scenario.label,
    description: scenario.description,
    appliedAt: scenario.appliedAt,
    timestamp: new Date().toISOString(),
  });
  // Keep max 20
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library.slice(0, 20)));
}

export function loadScenarioLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function removeScenarioFromLibrary(scenarioId) {
  const library = loadScenarioLibrary().filter(s => s.id !== scenarioId);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return library;
}
