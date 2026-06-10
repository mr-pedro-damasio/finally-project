import React from 'react';
import { Portfolio } from '@/types';
import { colors } from '@/styles/theme';

interface HeaderProps {
  portfolio: Portfolio | null;
  connected: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function Header({ portfolio, connected }: HeaderProps) {
  const statusColor = connected ? colors.green : colors.red;
  const statusLabel = connected ? 'Connected' : 'Disconnected';

  const totalPnl = portfolio
    ? portfolio.positions.reduce((sum, p) => sum + p.unrealized_pnl, 0)
    : 0;
  const pnlColor = totalPnl > 0 ? colors.green : totalPnl < 0 ? colors.red : colors.textMuted;

  return (
    <header
      style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 20px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: colors.accent, fontWeight: 800, fontSize: '20px', letterSpacing: '0.04em' }}>
          FIN
        </span>
        <span style={{ color: colors.text, fontWeight: 800, fontSize: '20px' }}>ALLY</span>
        <span style={{ color: colors.textMuted, fontSize: '12px', marginLeft: '6px', fontWeight: 500 }}>
          AI Trading Terminal
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {portfolio && (
          <>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Portfolio Value
              </div>
              <div className="font-mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '20px', fontWeight: 700, color: colors.text }}>
                <span style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: pnlColor,
                }} />
                {fmt(portfolio.total_value)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Cash
              </div>
              <div className="font-mono" style={{ fontSize: '16px', fontWeight: 600, color: colors.accent }}>
                {fmt(portfolio.cash_balance)}
              </div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}`,
            transition: 'background 300ms ease, box-shadow 300ms ease',
          }} />
          <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 500 }}>{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
