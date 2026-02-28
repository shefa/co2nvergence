/**
 * Projects future emissions for a single installation.
 * @param {number[]} emissions - Array of 17 values for years 2008–2024. 0 = no report.
 * @param {number} nYears - Number of years to project forward (default 6 = 2025–2030)
 * @returns {number[]} - Projected emissions array, one value per future year
 */
export function projectEmissions(emissions, nYears = 6) {
    // Get the last 3 non-zero data points as (index, value) pairs
    const nonZero = emissions
        .map((v, i) => ({ i, v }))
        .filter(p => p.v > 0);

    // Not enough data — flat zero projection
    if (nonZero.length === 0) return Array(nYears).fill(0);

    // Only one data point — flat projection at that value
    if (nonZero.length === 1) return Array(nYears).fill(nonZero[0].v);

    // Use the last 3 non-zero points for linear regression
    const recent = nonZero.slice(-3);
    const xs = recent.map(p => p.i);
    const ys = recent.map(p => p.v);

    // Simple linear regression
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project forward — indices 17..22 = years 2025..2030
    return Array.from({ length: nYears }, (_, j) => {
        const idx = 17 + j;
        return Math.max(0, Math.round(slope * idx + intercept));
    });
}

export const ETS_CAP = {
    2025: 1.245,
    2026: 1.195,
    2027: 1.145,
    2028: 1.095,
    2029: 1.045,
    2030: 0.995,
};

