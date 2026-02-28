import React from 'react';
import { Check, X, Zap } from 'lucide-react';

const TYPE_COLORS = {
  production_change: { bg: '#2D6A4F', text: '#A8D5BA' },
  price_shock: { bg: '#5C3D1E', text: '#F4A261' },
  cap_change: { bg: '#4A1520', text: '#E63946' },
  coverage_delay: { bg: '#1A3C2E', text: '#52B788' },
  purchasing_style_override: { bg: '#2A2A4A', text: '#8B8BCD' },
};

const TYPE_LABELS = {
  production_change: 'Production',
  price_shock: 'Price Shock',
  cap_change: 'Cap Change',
  coverage_delay: 'Delay',
  purchasing_style_override: 'Style Override',
};

const STATUS_BORDER = {
  pending: 'var(--accent-amber)',
  applied: 'var(--accent-green)',
  cancelled: 'var(--border-color)',
};

const ScenarioCard = ({ scenario, status, onApply, onCancel }) => {
  const typeStyle = TYPE_COLORS[scenario.type] || TYPE_COLORS.production_change;
  const borderColor = STATUS_BORDER[status] || STATUS_BORDER.pending;

  const filterParts = [];
  if (scenario.filter?.country) filterParts.push(`Country: ${scenario.filter.country}`);
  if (scenario.filter?.sector) filterParts.push(`Sector: ${scenario.filter.sector}`);
  if (scenario.filter?.archetype) filterParts.push(`Archetype: ${scenario.filter.archetype}`);

  return (
    <div style={{
      backgroundColor: 'var(--bg-dark)',
      border: '1px solid var(--border-color)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '12px 15px',
      maxWidth: '85%',
      alignSelf: 'flex-start',
      animation: 'fadeIn 0.3s ease-in-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={14} style={{ color: borderColor }} />
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {scenario.label || 'Scenario'}
          </span>
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          backgroundColor: typeStyle.bg,
          color: typeStyle.text,
        }}>
          {TYPE_LABELS[scenario.type] || scenario.type}
        </span>
      </div>

      {/* Description */}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        {scenario.description}
      </div>

      {/* Filters & Duration */}
      <div style={{ fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
        {filterParts.map((part, i) => (
          <span key={i} style={{
            padding: '1px 6px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
          }}>{part}</span>
        ))}
        <span style={{
          padding: '1px 6px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
        }}>Duration: {scenario.duration_quarters}Q</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {status === 'pending' && (
          <>
            <button
              onClick={() => onApply(scenario)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                backgroundColor: 'var(--accent-green)', color: '#000',
                border: 'none', borderRadius: '4px', padding: '6px 14px',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
              }}
            >
              <Check size={14} /> Apply
            </button>
            <button
              onClick={() => onCancel(scenario.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                backgroundColor: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              <X size={14} /> Cancel
            </button>
          </>
        )}
        {status === 'applied' && (
          <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Check size={14} /> Scenario applied
          </span>
        )}
        {status === 'cancelled' && (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Cancelled
          </span>
        )}
      </div>
    </div>
  );
};

export default ScenarioCard;
