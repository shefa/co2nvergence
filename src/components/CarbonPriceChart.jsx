import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

const CarbonPriceChart = ({ simulation }) => {
    const { priceHistory, carbonPrice, lastQuarterDemand, lastQuarterSupply } = simulation;

    const data = priceHistory.map(record => ({
        name: `Q${record.q} '${record.year.toString().slice(2)}`,
        price: record.price,
        year: record.year
    }));

    // Find significant spikes/dips for annotations (> 10% change from previous Q)
    const renderCustomizedDot = (props) => {
        const { cx, cy, index, payload } = props;
        if (index === 0) return null;

        const prevPrice = data[index - 1].price;
        const pctChange = Math.abs((payload.price - prevPrice) / prevPrice);

        if (pctChange > 0.1) {
            return (
                <circle cx={cx} cy={cy} r={3} fill="#E63946" stroke="none" />
            );
        }
        return null;
    };

    const demandGt = lastQuarterDemand ? (lastQuarterDemand / 1e9).toFixed(3) : "0.000";
    const demandPct = lastQuarterSupply && lastQuarterSupply > 0
        ? Math.round(((lastQuarterDemand - lastQuarterSupply) / lastQuarterSupply) * 100)
        : 0;

    const demandSign = demandPct >= 0 ? '↑' : '↓';

    return (
        <div style={{
            padding: '15px',
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Carbon Price (EUR/tonne)
            </h3>

            <div style={{ height: '140px', width: '100%', marginBottom: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#666"
                            fontSize={10}
                            tickFormatter={(val, index) => {
                                // Only label Q1s explicitly to save space
                                return val.startsWith('Q1') ? val.split(' ')[1] : '';
                            }}
                        />
                        <YAxis stroke="#666" fontSize={10} domain={[0, 150]} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '0.8rem' }}
                            itemStyle={{ color: '#74C69D' }}
                            formatter={(value) => [`€${value.toFixed(2)}`, 'Price']}
                        />
                        <ReferenceLine y={carbonPrice} stroke="#F4A261" strokeDasharray="3 3" />
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#74C69D"
                            strokeWidth={2}
                            dot={renderCustomizedDot}
                            isAnimationActive={false} // Disable to keep it fast per tick
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Carbon price</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        €{carbonPrice.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>/ t</span>
                    </div>
                </div>
                <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Q{simulation.currentQuarter} demand</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {demandGt} Gt <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: demandPct >= 0 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                            ({demandSign} {Math.abs(demandPct)}% vs supply)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CarbonPriceChart;
