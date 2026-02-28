import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const countryCentroids = {
    DE: [10.4515, 51.1657], FR: [2.2137, 46.2276], PL: [19.1451, 51.9194],
    ES: [-3.7492, 40.4637], IT: [12.5674, 41.8719], GB: [-3.4360, 55.3781],
    NL: [5.2913, 52.1326], CZ: [15.4730, 49.8175], GR: [21.8243, 39.0742],
    BE: [4.4699, 50.5039], SE: [18.6435, 60.1282], FI: [25.7482, 61.9241],
    RO: [24.9668, 45.9432], AT: [14.5501, 47.5162], PT: [-8.2245, 39.3999],
};

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MapComponent = ({ currentYear, emissionsData, installationsData, activeSectors, onSelectInstallation, simulation }) => {
    const [tooltipData, setTooltipData] = useState(null);
    const containerRef = useRef();

    const getIntensityColor = (val) => {
        if (!val) return 'rgba(26, 60, 46, 0.8)'; // dark green / no report
        if (val < 100000) return 'var(--accent-green)'; // low
        if (val < 1000000) return 'var(--accent-amber)'; // medium
        return 'var(--accent-red)'; // high
    }

    // Pre-calculate circles grouped by sector
    const groupedDots = useMemo(() => {
        if (!installationsData || installationsData.length === 0) return {};
        const groups = {};
        installationsData.forEach(inst => {
            if (!groups[inst.s]) groups[inst.s] = [];
            groups[inst.s].push(inst);
        });
        return groups;
    }, [installationsData]);

    // Use a DOM ref to update colors to bypass React render cycle for 15,000 dots
    useEffect(() => {
        if (!containerRef.current || !installationsData?.length) return;

        const isProjected = currentYear > 2024;
        const yearIndex = isProjected ? currentYear - 2025 : currentYear - 2008;

        installationsData.forEach(inst => {
            if (activeSectors.has(inst.s)) {
                const el = document.getElementById(`dot-${inst.id}`);
                if (el) {
                    const val = isProjected ? (inst.p ? inst.p[yearIndex] : 0) : inst.e[yearIndex];

                    if (isProjected && simulation?.agentStates?.[inst.id]) {
                        // Use coverage ratio scale
                        const coverage = simulation.agentStates[inst.id].coverageRatio;
                        let color = '#1A3C2E'; // inactive
                        if (inst.archetype !== 'inactive') {
                            if (coverage >= 0.9) color = '#52B788';
                            else if (coverage >= 0.6) color = '#F4A261';
                            else color = '#E63946';
                        }
                        el.setAttribute('fill', color);
                    } else {
                        // Use historical intensity scale
                        el.setAttribute('fill', getIntensityColor(val));
                    }

                    // Apply Projection visual treatments via className
                    if (isProjected) {
                        el.classList.add('projected-dot');
                        el.style.opacity = '0.7';
                        if (val > 0) {
                            el.classList.add('pulsing-dot');
                        } else {
                            el.classList.remove('pulsing-dot');
                        }
                    } else {
                        el.classList.remove('projected-dot', 'pulsing-dot');
                        el.style.opacity = '1';
                    }
                }
            }
        });

    }, [currentYear, installationsData, activeSectors, simulation]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} ref={containerRef}>

            {/* Custom Tooltip Overlay */}
            {tooltipData && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    backgroundColor: 'var(--surface-dark)',
                    border: '1px solid var(--border-color)',
                    padding: '10px',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    minWidth: '150px'
                }}>
                    <strong>{tooltipData.id}</strong>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{tooltipData.sector} · {tooltipData.c}</div>
                    <div style={{ marginTop: '5px' }}>
                        {currentYear >= 2025 && '~'}{tooltipData.val > 0 ? `${Math.round(tooltipData.val).toLocaleString()} t CO₂e` : 'No report this year'}
                        {currentYear >= 2025 && tooltipData.val > 0 && ' (projected)'}
                    </div>
                </div>
            )}

            {/* Map Legend */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                backgroundColor: 'var(--surface-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                padding: '8px 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                zIndex: 10
            }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginRight: '5px' }}>
                    {currentYear >= 2025 ? 'Coverage Ratio' : 'Emissions Intensity'}
                </span>

                {currentYear >= 2025 ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#52B788' }}></div> ≥ 90%</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F4A261' }}></div> 60%-90%</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E63946' }}></div> &lt; 60%</div>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }}></div> Low</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-amber)' }}></div> Med</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-red)' }}></div> High</div>
                    </>
                )}
            </div>

            <ComposableMap
                projection="geoAzimuthalEqualArea"
                projectionConfig={{
                    rotate: [-15.0, -52.0, 0],
                    center: [0, 0],
                    scale: 1200
                }}
                style={{ width: '100%', height: '100%' }}
            >
                <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                        geographies.map((geo) => (
                            <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill="#15271E" // Use base color
                                stroke="var(--border-color)"
                                strokeWidth={0.5}
                                style={{
                                    default: { outline: 'none' },
                                    hover: { fill: '#1d3328', outline: 'none' },
                                    pressed: { outline: 'none' },
                                }}
                            />
                        ))
                    }
                </Geographies>

                {Object.entries(groupedDots).map(([sector, insts]) => (
                    <g
                        key={sector}
                        style={{ display: activeSectors.has(sector) ? 'block' : 'none' }}
                    >
                        {insts.map(inst => (
                            <MemoizedMarker
                                key={inst.id}
                                inst={inst}
                                yearIndex={currentYear - 2008}
                                setTooltipData={setTooltipData}
                                onSelectInstallation={onSelectInstallation}
                                getIntensityColor={getIntensityColor}
                            />
                        ))}
                    </g>
                ))}
            </ComposableMap>
        </div>
    );
};

// Memoize individual markers to prevent 15,000 React re-renders on every year tick
const MemoizedMarker = React.memo(({ inst, yearIndex, setTooltipData, onSelectInstallation, getIntensityColor }) => {
    const val = inst.e[yearIndex];

    // Base radius fixed for performance
    const r = val > 0 ? 3 : 2;

    return (
        <Marker coordinates={[inst.lng, inst.lat]}>
            <circle
                id={`dot-${inst.id}`}
                r={r}
                fill={getIntensityColor(val)}
                style={{
                    transition: 'fill 0.3s ease',
                    cursor: 'pointer'
                }}
                onMouseEnter={() => {
                    // Provide current toolip specific to this inst
                    // We'll read the latest val dynamically if it's rendered, but using standard ref approach is cleaner.
                    const currentEl = document.getElementById(`dot-${inst.id}`);
                    const currentFill = currentEl?.getAttribute('fill');
                    // Quick hack to map fill color back to roughly knowing if it's 0 (since true val might be stale)
                    // Actually, we can just grab it dynamically from inst.e based on a window global or parent state if needed,
                    // but memoizing means this val is fixed to initial render.
                    const currentYearParam = document.querySelector('.top-bar-year-display')?.innerText || "2008";
                    const isProjectedView = currentYearParam.includes('~');
                    const cleanYear = parseInt(currentYearParam.replace('~', ''));
                    const dynamicYearIndex = isNaN(cleanYear) ? yearIndex : (isProjectedView ? cleanYear - 2025 : cleanYear - 2008);
                    const dynamicVal = isProjectedView ? (inst.p ? inst.p[dynamicYearIndex] : 0) : inst.e[dynamicYearIndex];

                    setTooltipData({ id: inst.id, sector: inst.s, c: inst.c, val: dynamicVal });
                    if (currentEl) {
                        currentEl.style.stroke = "white";
                        currentEl.style.strokeWidth = "1";
                    }
                }}
                onMouseLeave={() => {
                    setTooltipData(null)
                    const currentEl = document.getElementById(`dot-${inst.id}`);
                    if (currentEl) currentEl.style.stroke = "none";
                }}
                onClick={() => onSelectInstallation(inst)}
            />
        </Marker>
    )
}, (prevProps, nextProps) => {
    // Never re-render for year changes, only for completely new installations
    return prevProps.inst.id === nextProps.inst.id;
});

export default MapComponent;
