import { getArchetype } from './archetypes';

function stripThinking(text) {
  return text.replace(/^[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export function isLLMTier(inst) {
  return inst.archetype === 'conservative' || inst.archetype === 'speculative';
}

export function buildPersonalityPrompt(inst) {
  const years = [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];

  // Format history — only non-zero years
  const historyLines = years
    .map((y, i) => inst.e[i] > 0 ? `${y}: ${inst.e[i].toLocaleString()}` : null)
    .filter(Boolean);

  // Compute year-over-year changes for non-zero consecutive pairs
  const nonZeroPairs = [];
  for (let i = 1; i < years.length; i++) {
    if (inst.e[i] > 0 && inst.e[i-1] > 0) {
      const pct = ((inst.e[i] - inst.e[i-1]) / inst.e[i-1] * 100).toFixed(1);
      nonZeroPairs.push(`${years[i]}: ${pct > 0 ? '+' : ''}${pct}%`);
    }
  }

  return `You are analysing a real EU ETS industrial installation to build its carbon market personality profile.

Installation: ${inst.id}
Sector: ${inst.s}
Country: ${inst.c}

Verified emissions history (tonnes CO₂e, years with zero omitted):
${historyLines.join(' | ')}

Year-on-year changes:
${nonZeroPairs.join(' | ')}

Based solely on this 17-year emissions record, infer:
1. STABILITY: How stable or erratic is this facility's output? (e.g. "rock-solid cement plant", "highly cyclical energy generator", "irregular operator with frequent shutdowns")
2. TREND: What is the long-term direction and why might that be? (e.g. "steady decline suggesting aging plant or efficiency gains", "growth with recent pullback")
3. SHOCK_RESPONSE: How did this facility respond to the 2008-09 financial crisis and the 2020 COVID shock? Did it recover? (note: 2020 index is position 12 in the array)
4. PURCHASING_STYLE: Given this production profile, how would a rational compliance manager at this facility approach carbon credit purchasing? (e.g. "would front-load heavily given stable predictable output", "would time purchases carefully given volatile production making annual estimates unreliable")
5. PERSONALITY_SUMMARY: A single sentence (max 25 words) capturing this installation's character as a carbon market participant.

Respond only with valid JSON, no other text:
{
  "stability": "<one sentence>",
  "trend": "<one sentence>",
  "shock_response": "<one sentence>",
  "purchasing_style": "<one sentence>",
  "personality_summary": "<max 25 words>"
}`;
}

export function buildDecisionPrompt(inst, personality, agentState, simulation, scenarioOverride = '') {
  const years = [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
  const historyLines = years
    .map((y, i) => inst.e[i] > 0 ? `${y}: ${inst.e[i].toLocaleString()}` : null)
    .filter(Boolean)
    .join(' | ');

  const recentPrices = simulation.priceHistory.slice(-4)
    .map(p => `Q${p.q} ${p.year}: €${p.price}`)
    .join(' | ');

  const priceTrend = simulation.priceHistory.length >= 2
    ? ((simulation.carbonPrice - simulation.priceHistory.at(-2).price)
        / simulation.priceHistory.at(-2).price * 100).toFixed(1)
    : '0.0';

  return `You are the carbon compliance manager for EU ETS installation ${inst.id}. Sector: ${inst.s}. Country: ${inst.c}.

Your operational profile (inferred from 17 years of verified data):
- Stability: ${personality.stability}
- Trend: ${personality.trend}
- How you've handled economic shocks: ${personality.shock_response}
- Your purchasing style: ${personality.purchasing_style}

Your character: ${personality.personality_summary}

Emissions history: ${historyLines}

Current situation — Q${simulation.currentQuarter} ${simulation.currentYear}:
- Projected annual emissions: ${agentState.projectedAnnual.toLocaleString()} t
- Credits held: ${agentState.creditsHeld.toLocaleString()} t (${(agentState.coverageRatio * 100).toFixed(1)}% coverage)
- YTD emissions: ${agentState.ytdEmissions.toLocaleString()} t
- Carbon price: €${simulation.carbonPrice.toFixed(2)}/t (${priceTrend}% this quarter)
- Recent prices: ${recentPrices}

Act as this specific installation — not a generic archetype. Your purchasing history and
operational character should drive this decision. How many credits do you buy this quarter?
${scenarioOverride}
JSON only: {"buy_volume": <integer tonnes>, "reasoning": "<max 20 words>"}`;
}

const VLLM_BASE_URL = '/llm/v1';

async function inferPersonality(inst) {
  const prompt = buildPersonalityPrompt(inst);
  try {
    const res = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer EMPTY',
      },
      body: JSON.stringify({
        model: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16',
        max_tokens: 200,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = stripThinking(data.choices[0].message.content).replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return { id: inst.id, personality: parsed, success: true };
  } catch {
    return {
      id: inst.id,
      personality: {
        stability: 'Profile unavailable.',
        trend: 'Profile unavailable.',
        shock_response: 'Profile unavailable.',
        purchasing_style: 'Will follow standard archetype coverage targets.',
        personality_summary: `${getArchetype(inst.e)} buyer based on emissions profile.`,
      },
      success: false,
    };
  }
}

export async function inferAllPersonalities(llmTierInsts, onProgress) {
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < llmTierInsts.length; i += BATCH_SIZE) {
    const batch = llmTierInsts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(inst => inferPersonality(inst))
    );
    results.push(...batchResults);
    const latest = batchResults[batchResults.length - 1];
    onProgress(
      Math.min(i + BATCH_SIZE, llmTierInsts.length),
      llmTierInsts.length,
      latest
    );
    await new Promise(r => setTimeout(r, 100));
  }

  // Convert to object keyed by id
  const personalities = {};
  results.forEach(r => {
    personalities[r.id] = r.personality;
  });
  return personalities;
}

export async function makeLLMDecision(inst, personality, agentState, simulation, scenarioOverride = '') {
  const prompt = buildDecisionPrompt(inst, personality, agentState, simulation, scenarioOverride);
  try {
    const res = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer EMPTY',
      },
      body: JSON.stringify({
        model: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16',
        max_tokens: 100,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = stripThinking(data.choices[0].message.content).replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return {
      buy_volume: Math.max(0, Math.round(parsed.buy_volume || 0)),
      reasoning: parsed.reasoning || 'No reasoning provided.',
      success: true,
    };
  } catch {
    return null; // signals fallback to rule-based
  }
}
