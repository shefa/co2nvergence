import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import {
    ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot
} from 'recharts';
import { ETS_CAP } from '../utils/projection';

const TrajectoryChart = ({ currentYear, historicalTotals, projectedTotals }) => {

    const chartData = useMemo(() => {
        const data = [];
        // Combine 2008 to 2030
        for (let y = 2008; y <= 2030; y++) {
            const histVal = y <= 2024 ? historicalTotals[y] : undefined;
            const projVal = y >= 2025 ? projectedTotals[y] : undefined;
            const capVal = ETS_CAP[y];

            data.push({
                year: y,
                historical: histVal,
                projected: projVal,
                cap: capVal
            });
        }
        return data;
    }, [historicalTotals, projectedTotals]);

    const projected2030 = projectedTotals?.[2030] || 0;
    const actual2024 = historicalTotals?.[2024] || 0;
    const changePct = actual2024 > 0 ? ((projected2030 - actual2024) / actual2024) * 100 : 0;
    const isIncrease = changePct > 0;

    return (
        <div style={{
            width: '100%',
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                padding: '12px 15px',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: 'bold',
                color: 'var(--text-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>EU Trajectory (Gt CO₂e)</span>
            </div>

            <div style={{ padding: '15px 15px 5px 15px', height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="year"
                            stroke="var(--text-secondary)"
                            fontSize={10}
                            tickFormatter={(tick) => tick === 2008 || tick === 2024 || tick === 2030 ? tick : ''}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={10}
                            tickCount={4}
                            domain={['dataMin - 0.2', 'dataMax + 0.2']}
                            tickFormatter={(val) => val.toFixed(1)}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', fontSize: '11px' }}
                            labelStyle={{ color: 'var(--text-primary)' }}
                            itemStyle={{ padding: '2px 0' }}
                            formatter={(value, name) => [value.toFixed(3), name]}
                        />
                        <ReferenceLine x={2024.5} stroke="var(--text-secondary)" strokeDasharray="3 3" />

                        {/* Historical Line */}
                        <Line
                            type="monotone"
                            dataKey="historical"
                            stroke="#52B788"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            isAnimationActive={false}
                        />
                        {/* Projected Line */}
                        <Line
                            type="monotone"
                            dataKey="projected"
                            stroke="#52B788"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            activeDot={{ r: 4 }}
                            opacity={0.6}
                            isAnimationActive={false}
                        />
                        {/* ETS Phase 4 Cap */}
                        <Line
                            type="stepAfter"
                            dataKey="cap"
                            stroke="#E63946"
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                        />

                        {/* Moving Point tracker for Current Year */}
                        <ReferenceDot
                            x={currentYear}
                            y={currentYear >= 2025 ? chartData.find(d => d.year === currentYear)?.projected : chartData.find(d => d.year === currentYear)?.historical}
                            r={4}
                            fill="white"
                            stroke="var(--bg-dark)"
                            strokeWidth={2}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div style={{
                padding: '10px 15px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                    <span>Projected 2030 total</span>
                    <strong>~{projected2030.toFixed(2)} Gt</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>vs 2024 actual</span>
                    <span style={{ color: isIncrease ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 'bold' }}>
                        {isIncrease ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}%
                    </span>
                </div>
            </div>

            <div style={{ padding: '0px 15px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '10px', height: '2px', backgroundColor: '#52B788' }}></div>
                    Actual
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '10px', height: '2px', backgroundColor: '#52B788', borderBottom: '2px dashed var(--bg-dark)' }}></div>
                    Projected
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '10px', height: '2px', backgroundColor: '#E63946' }}></div>
                    Legal Cap
                </div>
            </div>
        </div>
    );
};

export default TrajectoryChart;
