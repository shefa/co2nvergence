export function getArchetype(emissions) {
  const nonZero = emissions.filter(v => v > 0);
  if (nonZero.length < 2) return 'inactive';

  // Also inactive if last 3 years are all zero (ceased operations)
  const last3 = emissions.slice(-3);
  if (last3.every(v => v === 0)) return 'inactive';

  const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance = nonZero.reduce((acc, v) => acc + (v - avg) ** 2, 0) / nonZero.length;
  const cv = Math.sqrt(variance) / avg; // coefficient of variation

  // Linear trend across non-zero values
  const n = nonZero.length;
  const xs = nonZero.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = nonZero.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * nonZero[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const trendPct = slope / avg;

  if (avg > 128_000 && cv < 0.45)  return 'conservative';
  if (avg > 128_000 && cv >= 0.45) return 'speculative';
  if (trendPct < -0.06)           return 'winding_down';
  return 'cautious';
}
