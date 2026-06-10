# Frontend Visual Refresh — "Neo Terminal" Design

## Goal

The current frontend (dark theme, all-monospace `JetBrains Mono`, edge-to-edge flat
panels separated by 1px hairlines, 10-12px text, no shadows/depth/rounded corners)
reads as an "80s character-graphics" terminal. This refresh keeps the
Bloomberg-terminal *spirit* required by `planning/PLAN.md` (dark, dense,
data-rich, single-page) but gives it a modern 2024-era SaaS-dashboard polish:
depth, rounded cards, refined typography, gradient accents, and smooth
micro-interactions.

This is a **visual/styling refresh only** — no new features, no API changes, no
change to component data flow or state management. Every component keeps its
existing props, hooks, and behavior. Only markup structure (where needed for
new wrapper/card elements) and styling change.

## Scope

All components under `frontend/components/` and `frontend/pages/`, plus
`frontend/styles/globals.css`. Specifically:

- `pages/index.tsx` — layout shell, gutters/spacing
- `components/Header.tsx`
- `components/Watchlist.tsx`
- `components/MainChart.tsx`
- `components/PnLChart.tsx`
- `components/PortfolioHeatmap.tsx`
- `components/PositionsTable.tsx`
- `components/Chat.tsx`
- `components/Sparkline.tsx`
- `styles/globals.css`

Out of scope: backend, API contracts, test logic (existing tests should
continue to pass — see Testing section).

## 1. Typography

- Add **Inter** as the primary UI sans-serif font (via `next/font/google`,
  self-hosted/optimized — no runtime Google Fonts request). Used for: labels,
  headers, buttons, chat text, inputs, section titles.
- Keep a monospace font — **JetBrains Mono** (already loaded) — but restrict it
  to **numeric/tabular data only**: prices, quantities, P&L values, cash
  balance, percentages, table cells with numbers. This preserves the
  "trading terminal" numeric alignment feel while removing the dated look from
  prose/labels/buttons.
- Introduce a clearer type scale:
  - Section labels: 11px, uppercase, `letterSpacing: 0.08em`, `font-weight:
    600`, muted color (`--color-text-muted`)
  - Body/UI text (chat, inputs, buttons): 13px, `font-weight: 500`
  - Key numbers (portfolio value, selected ticker price): 20-24px,
    `font-weight: 700`, monospace
  - Table/list numeric cells: 12px, monospace, `tabular-nums`

## 2. Color & Depth System

Extend `globals.css` `@theme inline` tokens (additive — keep existing
`--color-accent`, `--color-primary`, `--color-secondary`, `--color-bg`):

```css
--color-bg: #0d1117;            /* page background, unchanged */
--color-surface: #12141f;       /* panel background (was #1a1a2e) */
--color-surface-raised: #181b29;/* hover/active surface */
--color-border: #232633;        /* subtle 1px borders, low-alpha */
--color-text: #e2e8f0;          /* unchanged */
--color-text-muted: #7d869c;    /* slightly warmer than #718096 */
```

- **Cards/panels**: `border-radius: 12px`, `border: 1px solid
  var(--color-border)`, `box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px
  rgba(255,255,255,0.02) inset` (subtle inner highlight for depth).
- **Page background**: subtle radial gradient wash behind the header/top of
  page using accent yellow/blue at very low opacity (~4-6%), purely
  decorative, `pointer-events: none`, fixed position.
- **Layout gutters**: replace the current 1px `background: #2d2d3e` gap-trick
  between flush panels with real `gap: 12px` and `padding: 12px` on the page
  container, each panel becoming its own rounded card on `--color-surface`.
- Brand colors (`#ecad0a`, `#209dd7`, `#753991`) are used for: active/selected
  states (left border + soft glow), primary buttons (gradient fill), chat
  assistant accents, and chart line colors — same semantic usage as today, just
  restyled (gradients/glows instead of flat fills where it reads as "buttons"
  or "active state").

## 3. Layout & Spacing (`pages/index.tsx`)

- Replace the `gap: '1px', background: '#2d2d3e'` flush-panel trick with
  `gap: 12px` on a `--color-bg` page background; each region (Watchlist,
  MainChart, Positions, PnL, Heatmap, Chat) becomes an independently rounded
  card per §2.
- Outer page padding: 12px.
- Header becomes visually distinct: rounded-bottom card feel is unnecessary
  (it's full-width), but gets the radial gradient wash background and slightly
  taller (56px) with more breathing room around the portfolio value /
  cash figures.
- Section header bars (e.g., "Positions", "P&L History", "Portfolio Heatmap",
  "Watchlist", "AI Assistant") keep their uppercase muted-label style but move
  to Inter font, get a small leading icon (simple inline SVG/unicode glyph,
  e.g. a dot/chart icon) for visual rhythm, and sit inside the card's padding
  rather than abutting the card edge.

## 4. Component-Level Changes

### Header
- Inter font for "FINALLY" wordmark + "AI TRADING TERMINAL" subtitle.
- Portfolio value gets larger (24px, monospace, bold) with a small colored
  trend dot/arrow based on session P&L direction (computed from existing
  `livePortfolio` data — no new data needed).
- Connection status dot keeps its glow but gets a smoother color transition.

### Watchlist
- Each row: `border-radius: 8px` on hover/selected, `transition: background
  150ms ease, transform 150ms ease`, slight `translateX(2px)` on hover for
  tactile feel.
- Selected row: gradient left-border (accent blue → transparent) + soft
  background glow instead of flat `#1e2a3a`.
- Price flash animation (§6) updated but same trigger logic.
- "Add ticker" input/button restyled with rounded-pill input + gradient submit
  button.

### MainChart / PnLChart
- Restyle Lightweight Charts theme options: background `transparent` (card
  background shows through), grid lines `--color-border` at lower opacity,
  crosshair colors updated to accent blue.
- Add a subtle gradient area fill under the line series (using
  `AreaSeries`/`addSeries` gradient `topColor`/`bottomColor` options already
  supported by lightweight-charts) instead of plain `LineSeries`, for a more
  modern "stock app" look. Line color stays accent blue (MainChart) / accent
  yellow (PnLChart).
- Ticker label overlay restyled with Inter, slightly larger.

### PositionsTable
- Header row: Inter, muted, slightly more padding.
- Data rows: numeric columns stay monospace/tabular-nums; row hover gets
  subtle background highlight.
- Trade bar: inputs become rounded-pill, BUY/SELL buttons get gradient fills
  (green gradient / red gradient) with hover lift (`transform: translateY(-1px)`
  + shadow).

### PortfolioHeatmap
- Tiles get `border-radius: 10px`, subtle inset highlight, hover scale
  (`transform: scale(1.03)`, transition 150ms) and shadow for tactility.
- Color scale unchanged (already semantic green/red by P&L%).

### Chat
- Message bubbles: Inter font, `border-radius: 12px`, user messages get a
  subtle gradient background (blue-tinted), assistant messages get the new
  surface color with a thin gradient border accent.
- "Thinking..." indicator becomes animated dots (3 dots, staggered
  pulse/opacity animation) instead of pulsing text.
- Trade/watchlist confirmation chips (`TradeResult`, `WatchlistChange`)
  restyled with rounded-pill shape, icon glyph (✓ / ✗ / +/-), Inter font.
- Input + send button: rounded-pill input, gradient send button (purple,
  matching `--color-secondary`) with hover lift.

### Sparkline
- No structural change (canvas-based). Optionally increase line width to 2px
  and add a faint gradient fill under the line for visual consistency with
  MainChart/PnLChart — purely cosmetic, same `data`/`color` props.

## 5. Buttons & Inputs (shared patterns)

- All text inputs: `border-radius: 8px` (or `9999px` for chat/watchlist add —
  pill style), `background: var(--color-surface-raised)`, `border: 1px solid
  var(--color-border)`, `focus` state gets accent-colored border glow
  (`box-shadow: 0 0 0 2px rgba(32,157,215,0.2)`).
- Primary buttons (Send, Buy): gradient background (`linear-gradient` using
  the relevant brand color to a darker/lighter shade), `border-radius: 8px`,
  hover: `translateY(-1px)` + soft shadow, active: `translateY(0)`.
- Sell button: red gradient, same treatment.
- Remove/close buttons (×): unchanged interaction, restyled color/hover.

## 6. Motion / Animations (`globals.css`)

- Replace `flashUp`/`flashDown` keyframes: instead of a hard background flash,
  use a combined background + box-shadow glow pulse that fades over 600ms,
  e.g.:
  ```css
  @keyframes flashUp {
    0% { background-color: rgba(34,197,94,0.25); box-shadow: inset 0 0 12px rgba(34,197,94,0.3); }
    100% { background-color: transparent; box-shadow: none; }
  }
  ```
  (mirrored for `flashDown` with red).
- New `@keyframes pulseDot` for the chat "thinking" indicator (3 dots,
  staggered `animation-delay`).
- New `@keyframes fadeSlideIn` (opacity 0→1, translateY 4px→0, ~200ms) applied
  to new chat messages as they're appended.
- General hover/selection transitions: 150-200ms ease for background, border,
  transform, box-shadow.

## 7. Fonts & Dependencies

- Add `Inter` via `next/font/google` in `pages/_app.tsx` (or `_document.tsx`),
  exposed as a CSS variable (`--font-inter`) and set as the default `body`
  font in `globals.css`. JetBrains Mono remains loaded (already is, per
  current `globals.css` reference) and exposed as `--font-mono`, applied
  explicitly to numeric elements.
- No new npm dependencies required — `next/font` is built into Next.js, and
  gradient area series is part of the already-installed `lightweight-charts`.

## 8. Testing

- Existing Jest/RTL tests (`__tests__/*.test.tsx`) assert on text content,
  roles, and behavior — not inline style values or class names tied to the old
  visual design — so they should continue to pass unchanged. If any test
  queries by a style-derived selector, update the test to query by role/text
  instead (behavior-preserving).
- No new automated visual tests are introduced. Manual verification: run
  `npm run dev`, visually confirm each panel, hover/selection states, price
  flash, chat send, and chart rendering against the design described above.

## 9. Non-Goals

- No layout restructuring beyond spacing/gutters described in §3 (panel
  positions/proportions stay as-is).
- No new color palette beyond the brand colors + the additive surface/border
  tokens in §2.
- No changes to SSE handling, API calls, or state management.
- No dark/light theme toggle — dark only, per `planning/PLAN.md`.
