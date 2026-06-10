# Frontend Visual Refresh ("Neo Terminal") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the FinAlly frontend from a flat, all-monospace, hairline-bordered "80s terminal" look to a modern dark dashboard ("Neo Terminal"): Inter for UI text, monospace reserved for numeric data, rounded card panels with depth/shadows, gradient accents, gradient-filled charts, and smoother micro-interactions — with no changes to data flow, props, hooks, or API calls.

**Architecture:** Add a shared style module (`frontend/styles/theme.ts`) with reusable tokens/snippets (colors, card, section header, input, gradient button) used by every component. Load Inter + JetBrains Mono via `next/font/google` and expose them as CSS variables on `<html>` via `_document.tsx`. Extend `globals.css` with new tokens, animations, and a few hover-state classes (inline styles can't do `:hover`/`:focus`). Then restyle each component file in place, reusing the shared tokens.

**Tech Stack:** Next.js (Pages Router) + React 19 + TypeScript, Tailwind v4 (`@theme inline`), `next/font/google`, `lightweight-charts` v5 (switch `LineSeries` → `AreaSeries` with gradient fill for MainChart/PnLChart).

---

## Spec Reference

This plan implements `docs/superpowers/specs/2026-06-10-frontend-visual-refresh-design.md` ("Neo Terminal" design). Re-read that file for full rationale; this plan focuses on exact file changes.

---

## Task 1: Shared theme module

**Files:**
- Create: `frontend/styles/theme.ts`

- [ ] **Step 1: Create the theme module**

```ts
// frontend/styles/theme.ts
import { CSSProperties } from 'react';

export const colors = {
  bg: '#0d1117',
  surface: '#12141f',
  surfaceRaised: '#181b29',
  border: '#232633',
  text: '#e2e8f0',
  textMuted: '#7d869c',
  accent: '#ecad0a',
  primary: '#209dd7',
  secondary: '#753991',
  green: '#22c55e',
  red: '#ef4444',
} as const;

/** Rounded, elevated panel background. Apply to each top-level region. */
export const card: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02) inset',
  overflow: 'hidden',
};

/** Uppercase muted label bar at the top of a card. */
export const sectionHeader: CSSProperties = {
  padding: '10px 14px',
  borderBottom: `1px solid ${colors.border}`,
  fontSize: '11px',
  fontWeight: 600,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

/** Pill-shaped text input used in trade bar, watchlist add, and chat. */
export const inputStyle: CSSProperties = {
  background: colors.surfaceRaised,
  border: `1px solid ${colors.border}`,
  borderRadius: '9999px',
  color: colors.text,
  padding: '7px 14px',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
};

/** Gradient action button (Buy / Send / Add). Pass two hex colors for the gradient. */
export function gradientButton(from: string, to: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${from}, ${to})`,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/styles/theme.ts
git commit -m "feat(frontend): add shared theme tokens for visual refresh"
```

---

## Task 2: Load Inter + JetBrains Mono via next/font

**Files:**
- Create: `frontend/styles/fonts.ts`
- Modify: `frontend/pages/_document.tsx`

- [ ] **Step 1: Create the font loader module**

```ts
// frontend/styles/fonts.ts
import { Inter, JetBrains_Mono } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

- [ ] **Step 2: Apply the font CSS variables to `<html>`**

Replace the full contents of `frontend/pages/_document.tsx`:

```tsx
import { Html, Head, Main, NextScript } from "next/document";
import { inter, jetbrainsMono } from "@/styles/fonts";

export default function Document() {
  return (
    <Html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

- [ ] **Step 3: Run the build to confirm fonts load correctly**

Run: `cd frontend && npm run build`
Expected: build succeeds (exit code 0), no font-related errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/styles/fonts.ts frontend/pages/_document.tsx
git commit -m "feat(frontend): load Inter and JetBrains Mono via next/font"
```

---

## Task 3: Update `globals.css` — tokens, base font, animations, hover classes

**Files:**
- Modify: `frontend/styles/globals.css`

- [ ] **Step 1: Replace the full contents of `frontend/styles/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-accent: #ecad0a;
  --color-primary: #209dd7;
  --color-secondary: #753991;
  --color-bg: #0d1117;
  --color-surface: #12141f;
  --color-surface-raised: #181b29;
  --color-border: #232633;
  --color-text-muted: #7d869c;
}

html {
  height: 100%;
}

body {
  height: 100%;
  background: #0d1117;
  color: #e2e8f0;
  font-family: var(--font-inter), system-ui, sans-serif;
  position: relative;
}

/* Decorative radial glow behind the top of the page. Purely visual. */
body::before {
  content: '';
  position: fixed;
  top: -200px;
  left: 0;
  right: 0;
  height: 400px;
  background:
    radial-gradient(ellipse 60% 100% at 20% 0%, rgba(236, 173, 10, 0.06), transparent 70%),
    radial-gradient(ellipse 60% 100% at 80% 0%, rgba(32, 157, 215, 0.06), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* Numeric/tabular data: prices, quantities, P&L, cash. */
.font-mono {
  font-family: var(--font-mono), 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

@keyframes flashUp {
  0% {
    background-color: rgba(34, 197, 94, 0.25);
    box-shadow: inset 0 0 12px rgba(34, 197, 94, 0.3);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

@keyframes flashDown {
  0% {
    background-color: rgba(239, 68, 68, 0.25);
    box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.3);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.flash-up { animation: flashUp 600ms ease-out; }
.flash-down { animation: flashDown 600ms ease-out; }

/* Watchlist rows */
.watchlist-row {
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: background 150ms ease, transform 150ms ease, border-color 150ms ease;
}
.watchlist-row:hover {
  background: var(--color-surface-raised);
  transform: translateX(2px);
}
.watchlist-row.selected {
  background: linear-gradient(90deg, rgba(32,157,215,0.14), transparent);
  border-left: 2px solid var(--color-primary);
}

/* Position table rows */
.position-row {
  transition: background 150ms ease;
}
.position-row:hover {
  background: var(--color-surface-raised);
}

/* Portfolio heatmap tiles */
.heatmap-tile {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.heatmap-tile:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
}

/* Inputs */
.themed-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(32, 157, 215, 0.2);
}

/* Gradient buttons */
.gradient-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.35);
}
.gradient-button:active:not(:disabled) {
  transform: translateY(0);
}

/* Chat "thinking" dots */
@keyframes pulseDot {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}
.thinking-dots span {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 1px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: pulseDot 1.2s infinite ease-in-out;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.3s; }

/* New chat message entrance */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.msg-fade-in {
  animation: fadeSlideIn 200ms ease-out;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #0d1117;
}
::-webkit-scrollbar-thumb {
  background: #232633;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #2f3344;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/styles/globals.css
git commit -m "feat(frontend): refresh design tokens, fonts, and animations"
```

---

## Task 4: Update layout shell (`pages/index.tsx`)

**Files:**
- Modify: `frontend/pages/index.tsx`

- [ ] **Step 1: Run existing tests to confirm baseline**

Run: `cd frontend && npm test`
Expected: PASS (all suites — `index.tsx` has no dedicated test file, but this confirms nothing is broken before the layout change)

- [ ] **Step 2: Replace the full contents of `frontend/pages/index.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Portfolio, WatchlistItem } from '@/types';
import { fetchPortfolio, fetchWatchlist } from '@/lib/api';
import { usePrices } from '@/hooks/usePrices';
import { card } from '@/styles/theme';
import Header from '@/components/Header';
import Watchlist from '@/components/Watchlist';
import MainChart from '@/components/MainChart';
import PortfolioHeatmap from '@/components/PortfolioHeatmap';
import PnLChart from '@/components/PnLChart';
import PositionsTable from '@/components/PositionsTable';
import Chat from '@/components/Chat';

export default function Home() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [tradeRefresh, setTradeRefresh] = useState(0);

  const { prices, firstSeen, history, connected } = usePrices();

  const refreshPortfolio = useCallback(() => {
    fetchPortfolio()
      .then(setPortfolio)
      .catch(() => {});
  }, []);

  const refreshWatchlist = useCallback(() => {
    fetchWatchlist()
      .then(data => {
        setWatchlistItems(data);
        if (!selectedTicker && data.length > 0) {
          setSelectedTicker(data[0].ticker);
        }
      })
      .catch(() => {});
  }, [selectedTicker]);

  useEffect(() => {
    refreshPortfolio();
    refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  const handleTradeComplete = useCallback(() => {
    refreshPortfolio();
    setTradeRefresh(n => n + 1);
  }, [refreshPortfolio]);

  // Sync portfolio positions with live prices
  const livePortfolio: Portfolio | null = portfolio ? {
    ...portfolio,
    positions: portfolio.positions.map(pos => {
      const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
      const pnl = (livePrice - pos.avg_cost) * pos.quantity;
      const pct = pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
      return {
        ...pos,
        current_price: livePrice,
        unrealized_pnl: pnl,
        pnl_percent: pct,
      };
    }),
    total_value: portfolio.cash_balance + portfolio.positions.reduce((sum, pos) => {
      const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
      return sum + pos.quantity * livePrice;
    }, 0),
  } : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0d1117',
      color: '#e2e8f0',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 1,
    }}>
      <Header portfolio={livePortfolio} connected={connected} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '12px', padding: '12px' }}>
        {/* Left: Watchlist */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
          <Watchlist
            items={watchlistItems}
            prices={prices}
            firstSeen={firstSeen}
            history={history}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onWatchlistChange={refreshWatchlist}
          />
        </div>

        {/* Center: Charts + Portfolio */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '12px' }}>
          {/* Top: Main chart */}
          <div style={{ flex: '0 0 45%', overflow: 'hidden', position: 'relative', ...card }}>
            <MainChart ticker={selectedTicker} history={history} />
          </div>

          {/* Bottom: Portfolio section */}
          <div style={{ flex: 1, display: 'flex', gap: '12px', overflow: 'hidden' }}>
            {/* Positions + Trade bar */}
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid #232633',
                fontSize: '11px',
                fontWeight: 600,
                color: '#7d869c',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                Positions
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PositionsTable
                  positions={livePortfolio?.positions || []}
                  onTradeComplete={handleTradeComplete}
                />
              </div>
            </div>

            {/* P&L chart + Heatmap */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative', ...card }}>
                <div style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#7d869c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 2,
                  background: '#12141f',
                  borderBottom: '1px solid #232633',
                }}>
                  P&L History
                </div>
                <div style={{ position: 'absolute', top: '34px', left: 0, right: 0, bottom: 0 }}>
                  <PnLChart refreshTrigger={tradeRefresh} />
                </div>
              </div>

              <div style={{ flex: '0 0 40%', overflow: 'hidden', position: 'relative', ...card }}>
                <div style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#7d869c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: '1px solid #232633',
                }}>
                  Portfolio Heatmap
                </div>
                <div style={{ overflow: 'auto', height: 'calc(100% - 38px)' }}>
                  <PortfolioHeatmap positions={livePortfolio?.positions || []} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
          <Chat onWatchlistChange={refreshWatchlist} onTradeComplete={handleTradeComplete} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests again to confirm nothing broke**

Run: `cd frontend && npm test`
Expected: PASS (all suites)

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/index.tsx
git commit -m "feat(frontend): restyle layout shell with rounded card panels and gutters"
```

---

## Task 5: Restyle `Header.tsx`

**Files:**
- Modify: `frontend/components/Header.tsx`
- Test: `frontend/__tests__/Header.test.tsx` (no changes expected — verifies behavior preserved)

- [ ] **Step 1: Run existing test to confirm baseline**

Run: `cd frontend && npm test -- Header`
Expected: PASS (4 tests)

- [ ] **Step 2: Replace the full contents of `frontend/components/Header.tsx`**

```tsx
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
```

- [ ] **Step 3: Run test again to confirm it still passes**

Run: `cd frontend && npm test -- Header`
Expected: PASS (4 tests) — text content (`ALLY`, `$12,000.00`, `$8,500.00`, `Connected`, `Disconnected`) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Header.tsx
git commit -m "feat(frontend): restyle header with Inter type, larger value, trend dot"
```

---

## Task 6: Restyle `Sparkline.tsx` (gradient fill)

**Files:**
- Modify: `frontend/components/Sparkline.tsx`

- [ ] **Step 1: Run watchlist test to confirm baseline (Sparkline is mocked there)**

Run: `cd frontend && npm test -- Watchlist`
Expected: PASS (6 tests)

- [ ] **Step 2: Replace the full contents of `frontend/components/Sparkline.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  data: Array<{ time: number; value: number }>;
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({ data, width = 80, height = 30, color = '#209dd7' }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data.map((point, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((point.value - min) / range) * height * 0.85 - height * 0.075,
    }));

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }, [data, width, height, color]);

  if (data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: '1px', background: '#232633' }} />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
}
```

- [ ] **Step 3: Run test again to confirm it still passes**

Run: `cd frontend && npm test -- Watchlist`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Sparkline.tsx
git commit -m "feat(frontend): add gradient fill under sparkline"
```

---

## Task 7: Restyle `Watchlist.tsx`

**Files:**
- Modify: `frontend/components/Watchlist.tsx`
- Test: `frontend/__tests__/Watchlist.test.tsx`

- [ ] **Step 1: Run existing test to confirm baseline**

Run: `cd frontend && npm test -- Watchlist`
Expected: PASS (6 tests)

- [ ] **Step 2: Replace the full contents of `frontend/components/Watchlist.tsx`**

```tsx
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
```

- [ ] **Step 3: Run test again to confirm it still passes**

Run: `cd frontend && npm test -- Watchlist`
Expected: PASS (6 tests) — row text/price/sparkline assertions are unaffected by class/style changes.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Watchlist.tsx
git commit -m "feat(frontend): restyle watchlist with hover/selection states and pill input"
```

---

## Task 8: Restyle `MainChart.tsx` (gradient area series)

**Files:**
- Modify: `frontend/components/MainChart.tsx`

- [ ] **Step 1: Run build to confirm baseline compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 2: Replace the full contents of `frontend/components/MainChart.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { colors } from '@/styles/theme';

interface MainChartProps {
  ticker: string | null;
  history: Record<string, Array<{ time: number; value: number }>>;
}

export default function MainChart({ ticker, history }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;

    import('lightweight-charts').then((lc) => {
      if (!containerRef.current) return;

      chart = lc.createChart(containerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: 'transparent' },
          textColor: colors.textMuted,
        },
        grid: {
          vertLines: { color: colors.border },
          horzLines: { color: colors.border },
        },
        crosshair: {
          vertLine: { color: colors.primary },
          horzLine: { color: colors.primary },
        },
        rightPriceScale: {
          borderColor: colors.border,
        },
        timeScale: {
          borderColor: colors.border,
          timeVisible: true,
          secondsVisible: true,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(lc.AreaSeries, {
        lineColor: colors.primary,
        topColor: 'rgba(32, 157, 215, 0.28)',
        bottomColor: 'rgba(32, 157, 215, 0.0)',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceLineVisible: true,
        priceLineColor: colors.primary,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    });

    return () => {
      if (chart) {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !ticker) return;

    const data = history[ticker] || [];
    if (data.length === 0) {
      series.setData([]);
      return;
    }

    const seen = new Set<number>();
    const unique = data
      .filter(p => {
        if (seen.has(p.time)) return false;
        seen.add(p.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);

    series.setData(unique);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [ticker, history]);

  const data = ticker ? (history[ticker] || []) : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {!ticker && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '13px', zIndex: 1, pointerEvents: 'none',
        }}>
          Select a ticker to view chart
        </div>
      )}
      {ticker && data.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '13px', zIndex: 1, pointerEvents: 'none',
        }}>
          Waiting for price data for {ticker}...
        </div>
      )}
      <div style={{
        position: 'absolute', top: '12px', left: '16px',
        fontSize: '15px', fontWeight: 700, color: colors.text, zIndex: 1,
        pointerEvents: 'none',
      }}>
        {ticker}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
```

- [ ] **Step 3: Run build again to confirm it still compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/components/MainChart.tsx
git commit -m "feat(frontend): restyle main chart with gradient area series"
```

---

## Task 9: Restyle `PnLChart.tsx` (gradient area series)

**Files:**
- Modify: `frontend/components/PnLChart.tsx`

- [ ] **Step 1: Run build to confirm baseline compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 2: Replace the full contents of `frontend/components/PnLChart.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { SnapshotPoint } from '@/types';
import { fetchPortfolioHistory } from '@/lib/api';
import { colors } from '@/styles/theme';

interface PnLChartProps {
  refreshTrigger?: number;
}

export default function PnLChart({ refreshTrigger }: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const [snapshots, setSnapshots] = useState<SnapshotPoint[]>([]);

  useEffect(() => {
    fetchPortfolioHistory()
      .then(setSnapshots)
      .catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;

    import('lightweight-charts').then((lc) => {
      if (!containerRef.current) return;

      chart = lc.createChart(containerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: 'transparent' },
          textColor: colors.textMuted,
        },
        grid: {
          vertLines: { color: colors.border },
          horzLines: { color: colors.border },
        },
        rightPriceScale: {
          borderColor: colors.border,
        },
        timeScale: {
          borderColor: colors.border,
          timeVisible: true,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(lc.AreaSeries, {
        lineColor: colors.accent,
        topColor: 'rgba(236, 173, 10, 0.28)',
        bottomColor: 'rgba(236, 173, 10, 0.0)',
        lineWidth: 2,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    });

    return () => {
      if (chart) {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || snapshots.length === 0) return;

    const seen = new Set<number>();
    const data = snapshots
      .map(s => ({
        time: Math.floor(new Date(s.recorded_at).getTime() / 1000) as number,
        value: s.total_value,
      }))
      .filter(p => {
        if (seen.has(p.time)) return false;
        seen.add(p.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);

    series.setData(data);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [snapshots]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {snapshots.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '12px', zIndex: 1, pointerEvents: 'none',
        }}>
          No portfolio history yet
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
```

- [ ] **Step 3: Run build again to confirm it still compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/components/PnLChart.tsx
git commit -m "feat(frontend): restyle P&L chart with gradient area series"
```

---

## Task 10: Restyle `PortfolioHeatmap.tsx`

**Files:**
- Modify: `frontend/components/PortfolioHeatmap.tsx`

- [ ] **Step 1: Run build to confirm baseline compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 2: Replace the full contents of `frontend/components/PortfolioHeatmap.tsx`**

```tsx
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
```

- [ ] **Step 3: Run build again to confirm it still compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/components/PortfolioHeatmap.tsx
git commit -m "feat(frontend): restyle portfolio heatmap with rounded hover tiles"
```

---

## Task 11: Restyle `PositionsTable.tsx`

**Files:**
- Modify: `frontend/components/PositionsTable.tsx`
- Test: `frontend/__tests__/PositionsTable.test.tsx`

- [ ] **Step 1: Run existing test to confirm baseline**

Run: `cd frontend && npm test -- PositionsTable`
Expected: PASS (5 tests)

- [ ] **Step 2: Replace the full contents of `frontend/components/PositionsTable.tsx`**

```tsx
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
```

- [ ] **Step 3: Run test again to confirm it still passes**

Run: `cd frontend && npm test -- PositionsTable`
Expected: PASS (5 tests) — text content (`AAPL`, `TSLA`, `No positions`, `TICKER`/`QTY` placeholders, `BUY`/`SELL`, `+$50.00`, `+2.70%`, `$-100.00`, `-8.00%`) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/PositionsTable.tsx
git commit -m "feat(frontend): restyle positions table and trade bar with gradient buttons"
```

---

## Task 12: Restyle `Chat.tsx`

**Files:**
- Modify: `frontend/components/Chat.tsx`
- Test: `frontend/__tests__/Chat.test.tsx`

- [ ] **Step 1: Run existing test to confirm baseline**

Run: `cd frontend && npm test -- Chat`
Expected: PASS (4 tests)

- [ ] **Step 2: Replace the full contents of `frontend/components/Chat.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { fetchChatHistory, sendChatMessage } from '@/lib/api';
import { colors, sectionHeader, inputStyle, gradientButton } from '@/styles/theme';

interface ChatProps {
  onWatchlistChange: () => void;
  onTradeComplete: () => void;
}

function TradeResult({ result }: {
  result: {
    ticker: string;
    side: string;
    quantity: number;
    success: boolean;
    price?: number;
    error?: string;
  }
}) {
  if (result.success) {
    return (
      <div style={{
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: '9999px',
        padding: '4px 10px',
        fontSize: '11px',
        color: colors.green,
        marginTop: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span>✓</span>
        {result.side === 'buy' ? 'Bought' : 'Sold'} {result.quantity} {result.ticker} @ ${result.price?.toFixed(2)}
      </div>
    );
  }
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '9999px',
      padding: '4px 10px',
      fontSize: '11px',
      color: colors.red,
      marginTop: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span>✗</span>
      Failed: {result.ticker} {result.side} {result.quantity} — {result.error}
    </div>
  );
}

function WatchlistChange({ change }: { change: { ticker: string; action: string } }) {
  return (
    <div style={{
      background: 'rgba(32,157,215,0.1)',
      border: '1px solid rgba(32,157,215,0.3)',
      borderRadius: '9999px',
      padding: '4px 10px',
      fontSize: '11px',
      color: colors.primary,
      marginTop: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span>{change.action === 'add' ? '+' : '−'}</span>
      {change.action === 'add' ? 'Added' : 'Removed'} {change.ticker} {change.action === 'add' ? 'to' : 'from'} watchlist
    </div>
  );
}

export default function Chat({ onWatchlistChange, onTradeComplete }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatHistory()
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(text);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.message,
        executed_actions: {
          trades: response.trades,
          watchlist_changes: response.watchlist_changes,
          trade_results: response.trade_results,
        },
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (response.trade_results?.some(r => r.success)) {
        onTradeComplete();
      }
      if (response.watchlist_changes?.length > 0) {
        onWatchlistChange();
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that — please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={sectionHeader}>
        <span style={{ color: colors.accent }}>AI</span> Assistant
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {loadingHistory && (
          <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            Loading history...
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            Ask FinAlly anything about your portfolio, or request trades.
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="msg-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '90%',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(32,157,215,0.18), rgba(32,157,215,0.06))'
                : colors.surfaceRaised,
              border: `1px solid ${msg.role === 'user' ? 'rgba(32,157,215,0.3)' : colors.border}`,
              borderRadius: '12px',
              padding: '9px 12px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: colors.text,
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            {msg.executed_actions && (
              <div style={{ maxWidth: '90%', width: '100%' }}>
                {msg.executed_actions.trade_results?.map((r, i) => (
                  <TradeResult key={i} result={r} />
                ))}
                {msg.executed_actions.watchlist_changes?.map((c, i) => (
                  <WatchlistChange key={i} change={c} />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '10px 14px',
            }}>
              <span className="thinking-dots">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} style={{
        padding: '10px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask FinAlly..."
          disabled={loading}
          className="themed-input"
          style={{ ...inputStyle, flex: 1, opacity: loading ? 0.7 : 1 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="gradient-button"
          style={{
            ...gradientButton(colors.secondary, '#4a2360'),
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Run test again to confirm it still passes**

Run: `cd frontend && npm test -- Chat`
Expected: PASS (4 tests) — `Assistant`, history messages, placeholder text, `Send`, and `/Bought 10 AAPL/` confirmation are all still rendered as plain text.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Chat.tsx
git commit -m "feat(frontend): restyle chat panel with gradient bubbles and animated indicator"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Jest suite**

Run: `cd frontend && npm test`
Expected: PASS — all suites (Header, Watchlist, Chat, PositionsTable) green.

- [ ] **Step 2: Run lint**

Run: `cd frontend && npm run lint`
Expected: no errors (warnings for pre-existing `no-explicit-any` in chart components are pre-existing and acceptable).

- [ ] **Step 3: Run production build**

Run: `cd frontend && npm run build`
Expected: build succeeds, static export produced.

- [ ] **Step 4: Manual visual check**

Run: `cd frontend && npm run dev`, open `http://localhost:3000` in a browser.

Verify:
- Inter is used for labels/buttons/chat text; numeric values (prices, P&L, cash, table cells) use the monospace font
- Each panel (Watchlist, Main Chart, Positions, P&L History, Portfolio Heatmap, Chat) is a rounded card with a visible shadow/border and 12px gutters between panels
- Watchlist row hover shifts slightly and highlights; selected row shows a gradient left border
- Price flash on a ticker shows a glow/fade (green up, red down)
- Main chart and P&L chart render as gradient-filled area charts
- Heatmap tiles have rounded corners and scale slightly on hover
- Buy/Sell/Send/+ buttons have gradient fills and lift slightly on hover
- Chat "thinking" indicator shows three pulsing dots; new messages fade/slide in

- [ ] **Step 5: Stop the dev server**

No commit needed for this task — it's verification only.
