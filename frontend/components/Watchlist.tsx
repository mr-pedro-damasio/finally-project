import React, { useState, useEffect, useRef } from 'react';
import { PriceUpdate, WatchlistItem } from '@/types';
import Sparkline from './Sparkline';
import { addToWatchlist, removeFromWatchlist } from '@/lib/api';
import { colors, sectionHeader, inputStyle, gradientButton } from '@/styles/theme';

interface WatchlistProps {
  items: WatchlistItem[];
  prices: Record<string, PriceUpdate>;
  firstSeen: Record<string, number>;
  history: Record<string, Array<{ time: number; value: number }>>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onWatchlistChange: () => void;
}

function fmt(n: number | null) {
  if (n === null) return '—';
  return '$' + n.toFixed(2);
}

function fmtPct(n: number | null) {
  if (n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

export default function Watchlist({
  items,
  prices,
  firstSeen,
  history,
  selectedTicker,
  onSelectTicker,
  onWatchlistChange,
}: WatchlistProps) {
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [flashState, setFlashState] = useState<Record<string, 'up' | 'down' | null>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const newFlash: Record<string, 'up' | 'down' | null> = {};
    let changed = false;

    for (const ticker of Object.keys(prices)) {
      const current = prices[ticker].price;
      const prev = prevPricesRef.current[ticker];
      if (prev !== undefined && prev !== current) {
        newFlash[ticker] = current > prev ? 'up' : 'down';
        changed = true;
      }
      prevPricesRef.current[ticker] = current;
    }

    if (changed) {
      setFlashState(prev => ({ ...prev, ...newFlash }));
      const timers = Object.keys(newFlash).map(ticker =>
        setTimeout(() => {
          setFlashState(prev => ({ ...prev, [ticker]: null }));
        }, 600)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [prices]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = addInput.trim().toUpperCase();
    if (!ticker) return;
    setAdding(true);
    setAddError('');
    try {
      await addToWatchlist(ticker);
      setAddInput('');
      onWatchlistChange();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    try {
      await removeFromWatchlist(ticker);
      onWatchlistChange();
    } catch {
      // Ignore
    }
  };

  const sessionPct = (ticker: string): number | null => {
    const price = prices[ticker]?.price ?? null;
    const first = firstSeen[ticker] ?? null;
    if (price === null || first === null || first === 0) return null;
    return ((price - first) / first) * 100;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={sectionHeader}>Watchlist</div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 70px 82px 24px',
        padding: '6px 14px',
        fontSize: '10px',
        color: colors.textMuted,
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}>
        <span>TICKER</span>
        <span style={{ textAlign: 'right' }}>PRICE</span>
        <span style={{ textAlign: 'right' }}>SESSION</span>
        <span style={{ textAlign: 'center' }}>CHART</span>
        <span />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        {items.map((item) => {
          const ticker = item.ticker;
          const price = prices[ticker]?.price ?? item.price;
          const pct = sessionPct(ticker);
          const flash = flashState[ticker];
          const isSelected = ticker === selectedTicker;
          const pctColor = pct === null ? colors.textMuted : pct >= 0 ? colors.green : colors.red;
          const sparkColor = pct === null ? colors.primary : pct >= 0 ? colors.green : colors.red;

          return (
            <div
              key={ticker}
              onClick={() => onSelectTicker(ticker)}
              className={`watchlist-row ${isSelected ? 'selected' : ''} ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 70px 82px 24px',
                alignItems: 'center',
                padding: '8px 8px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? colors.primary : colors.text }}>
                {ticker}
              </span>
              <span className="font-mono" style={{ textAlign: 'right', fontSize: '12px', color: colors.text }}>
                {fmt(price)}
              </span>
              <span className="font-mono" style={{ textAlign: 'right', fontSize: '11px', color: pctColor }}>
                {fmtPct(pct)}
              </span>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Sparkline data={history[ticker] || []} width={80} height={28} color={sparkColor} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '2px',
                  lineHeight: 1,
                }}
                title={`Remove ${ticker}`}
              >
                ×
              </button>
            </div>
          );
        })}

        {items.length === 0 && (
          <div style={{ padding: '20px 12px', color: colors.textMuted, fontSize: '12px', textAlign: 'center' }}>
            No tickers in watchlist
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} style={{
        padding: '10px 14px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
      }}>
        <input
          value={addInput}
          onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
          placeholder="Add ticker..."
          className="themed-input"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="submit"
          disabled={adding || !addInput.trim()}
          className="gradient-button"
          style={{
            ...gradientButton(colors.primary, '#1683b3'),
            padding: '7px 14px',
            opacity: adding || !addInput.trim() ? 0.5 : 1,
          }}
        >
          +
        </button>
      </form>
      {addError && (
        <div style={{ padding: '4px 14px 10px', fontSize: '11px', color: colors.red }}>
          {addError}
        </div>
      )}
    </div>
  );
}
