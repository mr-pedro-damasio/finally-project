import React from 'react';
import { Position } from '@/types';
import { colors } from '@/styles/theme';

interface PortfolioHeatmapProps {
  positions: Position[];
}

function pnlColor(pct: number): string {
  if (pct >= 5) return '#16a34a';
  if (pct >= 2) return '#22c55e';
  if (pct >= 0) return '#4ade80';
  if (pct >= -2) return '#f87171';
  if (pct >= -5) return '#ef4444';
  return '#dc2626';
}

export default function PortfolioHeatmap({ positions }: PortfolioHeatmapProps) {
  if (positions.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textMuted,
        fontSize: '12px',
      }}>
        No positions to display
      </div>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.quantity * p.current_price, 0) || 1;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', height: '100%', alignContent: 'flex-start' }}>
      {positions.map(pos => {
        const weight = (pos.quantity * pos.current_price) / totalValue;
        const minSize = 60;
        const size = Math.max(minSize, weight * 400);

        return (
          <div
            key={pos.ticker}
            title={`${pos.ticker}: ${pos.pnl_percent.toFixed(2)}% P&L`}
            className="heatmap-tile"
            style={{
              width: size,
              height: Math.max(50, size * 0.7),
              background: pnlColor(pos.pnl_percent),
              borderRadius: '10px',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: size > 80 ? '12px' : '10px',
              fontWeight: 700,
              cursor: 'default',
              overflow: 'hidden',
              padding: '4px',
            }}
          >
            <div>{pos.ticker}</div>
            {size > 70 && (
              <div className="font-mono" style={{ fontSize: '10px', opacity: 0.9 }}>
                {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(2)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
