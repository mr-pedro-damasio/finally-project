import React, { useState } from 'react';
import { Position } from '@/types';
import { executeTrade } from '@/lib/api';
import { colors, inputStyle, gradientButton } from '@/styles/theme';

interface PositionsTableProps {
  positions: Position[];
  onTradeComplete: () => void;
}

function fmt(n: number) {
  return '$' + n.toFixed(2);
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

export default function PositionsTable({ positions, onTradeComplete }: PositionsTableProps) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrade = async (side: 'buy' | 'sell') => {
    const t = ticker.trim().toUpperCase();
    const q = parseFloat(quantity);
    if (!t || isNaN(q) || q <= 0) {
      setTradeError('Enter a valid ticker and quantity');
      return;
    }
    setLoading(true);
    setTradeError('');
    setTradeSuccess('');
    try {
      const result = await executeTrade(t, side, q);
      setTradeSuccess(`${side === 'buy' ? 'Bought' : 'Sold'} ${result.quantity} ${result.ticker} @ ${fmt(result.price)}`);
      setTicker('');
      setQuantity('');
      onTradeComplete();
    } catch (err: unknown) {
      setTradeError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setLoading(false);
    }
  };

  const colStyle = {
    padding: '8px 10px',
    fontSize: '12px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' as const }}>
        {positions.length === 0 ? (
          <div style={{ padding: '20px', color: colors.textMuted, fontSize: '12px', textAlign: 'center' }}>
            No positions
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['TICKER', 'QTY', 'AVG COST', 'PRICE', 'P&L', 'P&L%'].map(h => (
                  <th key={h} style={{
                    ...colStyle,
                    color: colors.textMuted,
                    textAlign: h === 'TICKER' ? 'left' : 'right',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const pnlColor = pos.unrealized_pnl >= 0 ? colors.green : colors.red;
                return (
                  <tr key={pos.ticker} className="position-row" style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ ...colStyle, fontWeight: 600, color: colors.text }}>{pos.ticker}</td>
                    <td className="font-mono" style={{ ...colStyle, textAlign: 'right', color: colors.text }}>{pos.quantity}</td>
                    <td className="font-mono" style={{ ...colStyle, textAlign: 'right', color: colors.textMuted }}>{fmt(pos.avg_cost)}</td>
                    <td className="font-mono" style={{ ...colStyle, textAlign: 'right', color: colors.text }}>{fmt(pos.current_price)}</td>
                    <td className="font-mono" style={{ ...colStyle, textAlign: 'right', color: pnlColor }}>
                      {pos.unrealized_pnl >= 0 ? '+' : ''}{fmt(pos.unrealized_pnl)}
                    </td>
                    <td className="font-mono" style={{ ...colStyle, textAlign: 'right', color: pnlColor }}>
                      {fmtPct(pos.pnl_percent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Trade bar */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '10px 14px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={ticker}
            onChange={e => { setTicker(e.target.value.toUpperCase()); setTradeError(''); setTradeSuccess(''); }}
            placeholder="TICKER"
            className="themed-input"
            style={{ ...inputStyle, width: '90px' }}
          />
          <input
            value={quantity}
            onChange={e => { setQuantity(e.target.value); setTradeError(''); setTradeSuccess(''); }}
            placeholder="QTY"
            type="number"
            min="0"
            step="any"
            className="themed-input"
            style={{ ...inputStyle, width: '90px' }}
          />
          <button
            onClick={() => handleTrade('buy')}
            disabled={loading}
            className="gradient-button"
            style={{
              ...gradientButton('#22c55e', '#16803c'),
              opacity: loading ? 0.5 : 1,
            }}
          >
            BUY
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={loading}
            className="gradient-button"
            style={{
              ...gradientButton('#ef4444', '#991b1b'),
              opacity: loading ? 0.5 : 1,
            }}
          >
            SELL
          </button>
        </div>
        {tradeError && <div style={{ marginTop: '6px', fontSize: '11px', color: colors.red }}>{tradeError}</div>}
        {tradeSuccess && <div style={{ marginTop: '6px', fontSize: '11px', color: colors.green }}>{tradeSuccess}</div>}
      </div>
    </div>
  );
}
