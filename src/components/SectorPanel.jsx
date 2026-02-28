import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';

const SectorPanel = ({ sectorCounts, activeSectors, setActiveSectors }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSector = (sector) => {
        const newActive = new Set(activeSectors);
        if (newActive.has(sector)) {
            newActive.delete(sector);
        } else {
            newActive.add(sector);
        }
        setActiveSectors(newActive);
    };

    const toggleAll = (state) => {
        if (state) {
            setActiveSectors(new Set(Object.keys(sectorCounts)));
        } else {
            setActiveSectors(new Set());
        }
    };

    if (isCollapsed) {
        return (
            <div style={{
                position: 'absolute',
                top: '70px',
                left: '20px',
                zIndex: 20,
                backgroundColor: 'var(--surface-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }} onClick={() => setIsCollapsed(false)}>
                <ChevronRight size={20} color="var(--text-primary)" />
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            width: '220px',
            maxHeight: 'calc(70vh - 100px)',
            backgroundColor: 'var(--surface-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--top-bar)'
            }}>
                <strong style={{ fontSize: '0.95rem' }}>Sectors</strong>
                <button
                    onClick={() => setIsCollapsed(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    <ChevronLeft size={18} />
                </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                {Object.entries(sectorCounts).map(([sector, count]) => {
                    const isActive = activeSectors.has(sector);
                    return (
                        <div
                            key={sector}
                            onClick={() => toggleSector(sector)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 16px',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                backgroundColor: 'transparent'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {isActive ? <CheckSquare size={16} color="var(--accent-green)" /> : <Square size={16} />}
                                <span style={{ fontSize: '0.9rem' }}>{sector}</span>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {count.toLocaleString()}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Footer Controls */}
            <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '10px'
            }}>
                <button
                    onClick={() => toggleAll(true)}
                    style={{ flex: 1, padding: '4px 0', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    All
                </button>
                <button
                    onClick={() => toggleAll(false)}
                    style={{ flex: 1, padding: '4px 0', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    None
                </button>
            </div>
        </div>
    );
};

export default SectorPanel;
