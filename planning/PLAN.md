# FinAlly — AI Trading Workstation

## Project Specification

## 1. Vision

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot.

This is the capstone project for an agentic AI coding course. It is built entirely by Coding Agents demonstrating how orchestrated AI agents can produce a production-quality full-stack application. Agents interact through files in `planning/`.

## 2. User Experience

### First Launch

The user runs a single Docker command (or a provided start script). A browser opens to `http://localhost:8000`. No login, no signup. They immediately see:

- A watchlist of 10 default tickers with live-updating prices in a grid
- $10,000 in virtual cash
- A dark, data-rich trading terminal aesthetic
- An AI chat panel ready to assist

### What the User Can Do

- **Watch prices stream** — prices flash green (uptick) or red (downtick) with subtle CSS animations that fade
- **View sparkline mini-charts** — price action beside each ticker in the watchlist, accumulated on the frontend from the SSE stream since page load (sparklines fill in progressively)
- **Click a ticker** to see a larger detailed chart in the main chart area
- **Buy and sell shares** — market orders only, instant fill at current price, no fees, no confirmation dialog
- **Monitor their portfolio** — a heatmap (treemap) showing positions sized by weight and colored by P&L, plus a P&L chart tracking total portfolio value over time
- **View a positions table** — ticker, quantity, average cost, current price, unrealized P&L, % change
- **Chat with the AI assistant** — ask about their portfolio, get analysis, and have the AI execute trades and manage the watchlist through natural language
- **Manage the watchlist** — add/remove tickers manually or via the AI chat

### Visual Design

- **Dark theme**: backgrounds around `#0d1117` or `#1a1a2e`, muted gray borders, no pure black
- **Price flash animations**: brief green/red background highlight on price change, fading over ~500ms via CSS transitions
- **Connection status indicator**: a small colored dot (green = connected, yellow = reconnecting, red = disconnected) visible in the header
- **Professional, data-dense layout**: inspired by Bloomberg/trading terminals — every pixel earns its place
- **Responsive but desktop-first**: optimized for wide screens, functional on tablet

### Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)

## 3. Architecture Overview

### Single Container, Single Port

```
┌─────────────────────────────────────────────────┐
│  Docker Container (port 8000)                   │
│                                                 │
│  FastAPI (Python/uv)                            │
│  ├── /api/*          REST endpoints             │
│  ├── /api/stream/*   SSE streaming              │
│  └── /*              Static file serving         │
│                      (Next.js export)            │
│                                                 │
│  SQLite database (volume-mounted)               │
│  Background tasks:                              │
│    • market data polling/sim                    │
│    • portfolio snapshot recorder               │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Next.js with TypeScript, built as a static export (`output: 'export'`), served by FastAPI as static files
- **Backend**: FastAPI (Python), managed as a `uv` project
- **Database**: SQLite, single file at `db/finally.db`, volume-mounted for persistence
- **Real-time data**: Server-Sent Events (SSE) — simpler than WebSockets, one-way server→client push, works everywhere
- **AI integration**: LiteLLM → OpenRouter (Cerebras for fast inference), with structured outputs for trade execution
- **Market data**: Environment-variable driven — simulator by default, real data via Massive API if key provided
- **Single-page, no client-side routing**: selecting a ticker, toggling panels, etc. are all in-component state — the URL never changes. FastAPI serves the Next.js export as plain static files; no SPA-fallback routing to `index.html` is required

### Why These Choices

| Decision | Rationale |
|---|---|
| SSE over WebSockets | One-way push is all we need; simpler, no bidirectional complexity, universal browser support |
| Static Next.js export | Single origin, no CORS issues, one port, one container, simple deployment |
| SQLite over Postgres | No auth = no multi-user = no need for a database server; self-contained, zero config |
| Single Docker container | Students run one command; no docker-compose for production, no service orchestration |
| uv for Python | Fast, modern Python project management; reproducible lockfile; what students should learn |
| Market orders only | Eliminates order book, limit order logic, partial fills — dramatically simpler portfolio math |

---

## 4. Directory Structure

```
finally/
├── frontend/                 # Next.js TypeScript project (static export)
├── backend/                  # FastAPI uv project (Python)
│   ├── app/                  # Application code: routes, market data, LLM integration, etc.
│   ├── schema/               # Schema SQL definitions, seed data, migration logic
│   └── ...                   # tests/, pyproject.toml, etc. — internal structure is up to the Backend agents (see Key Boundaries)
├── planning/                 # Project-wide documentation for agents
│   ├── PLAN.md               # This document
│   └── ...                   # Additional agent reference docs
├── scripts/
│   ├── start_mac.sh          # Launch Docker container (macOS/Linux)
│   ├── stop_mac.sh           # Stop Docker container (macOS/Linux)
│   ├── start_windows.ps1     # Launch Docker container (Windows PowerShell)
│   ├── stop_windows.ps1      # Stop Docker container (Windows PowerShell)
│   └── test.sh               # Wrapper for E2E test docker-compose run
├── test/                     # Playwright E2E tests + docker-compose.test.yml
├── db/                       # SQLite file lives here for local/non-Docker runs
│   └── .gitkeep              # In the container, /app/db is a separate named volume (see §11)
├── Dockerfile                # Multi-stage build (Node → Python)
├── docker-compose.yml        # Optional convenience wrapper
├── .env                      # Environment variables (gitignored, .env.example committed)
└── .gitignore
```

### Key Boundaries

- **`frontend/`** is a self-contained Next.js project. It knows nothing about Python. It talks to the backend via `/api/*` endpoints and `/api/stream/*` SSE endpoints. Internal structure is up to the Frontend Engineer agent.
- **`backend/`** is a self-contained uv project with its own `pyproject.toml`. It owns all server logic including database initialization, schema, seed data, API routes, SSE streaming, market data, and LLM integration. Internal structure is up to the Backend/Market Data agents.
- **`backend/schema/`** contains schema SQL definitions and seed logic (named separately from the runtime `db/` below to avoid confusing "where the schema source lives" with "where the live database file lives"). The backend lazily initializes the database on first request — creating tables and seeding default data if the SQLite file doesn't exist or is empty.
- **`db/`** at the top level is where the backend writes `finally.db` when run directly outside Docker (e.g., local development). It is **not** the production persistence mechanism: in the container, `/app/db` is backed by a Docker-managed named volume (`finally-data`, see §11) — separate storage, not a bind mount of this directory. `db/.gitkeep` exists only so the path is present for non-containerized runs; `finally.db` is gitignored either way.
- **`planning/`** contains project-wide documentation, including this plan. All agents reference files here as the shared contract.
- **`test/`** contains Playwright E2E tests and supporting infrastructure (e.g., `docker-compose.test.yml`). Unit tests live within `frontend/` and `backend/` respectively, following each framework's conventions.
- **`scripts/`** contains start/stop scripts that wrap Docker commands.

---

## 5. Environment Variables

```bash
# Required: OpenRouter API key for LLM chat functionality
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Optional: Massive (Polygon.io) API key for real market data
# If not set, the built-in market simulator is used (recommended for most users)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (testing)
LLM_MOCK=false
```

### Behavior

- If `MASSIVE_API_KEY` is set and non-empty → backend uses Massive REST API for market data
- If `MASSIVE_API_KEY` is absent or empty → backend uses the built-in market simulator
- If `LLM_MOCK=true` → backend returns deterministic mock LLM responses (for E2E tests)
- If `LLM_MOCK` is absent or set to any value other than `"true"` → live LLM calls are made
- The backend reads `.env` from the project root (mounted into the container or read via docker `--env-file`)

> **TODO (actionable by any agent — not a note-to-self for whoever "owns" `.env.example`):** The committed `.env.example` at the repo root currently contains generic placeholders (`EXAMPLE_API_KEY=`, `EXAMPLE_DATABASE_URL=`) rather than the three variables documented above. It needs to be replaced with exactly the variable block shown earlier in this section — `OPENROUTER_API_KEY=your-openrouter-api-key-here`, `MASSIVE_API_KEY=`, `LLM_MOCK=false` — present (not commented out) with those exact placeholder/empty/default values, so that `cp .env.example .env` immediately yields a working setup: simulator-driven market data (no `MASSIVE_API_KEY`) and live LLM calls disabled by default (`LLM_MOCK=false`, awaiting a real `OPENROUTER_API_KEY`). This blocks the documented Quick Start in `README.md` ("copy `.env.example` to `.env` and fill in the values") from working on a fresh clone.

---

## 6. Market Data

### Two Implementations, One Interface

Both the simulator and the Massive client implement the same abstract interface. The backend selects which to use based on the environment variable. All downstream code (SSE streaming, price cache, frontend) is agnostic to the source.

### Simulator (Default)

- Generates prices using geometric Brownian motion (GBM) with configurable drift and volatility per ticker
- Updates at ~500ms intervals
- Correlated moves across tickers (e.g., tech stocks move together)
- Occasional random "events" — sudden 2-5% moves on a ticker for drama
- Starts from realistic seed prices (e.g., AAPL ~$190, GOOGL ~$175, etc.) for a curated set of well-known tickers, with per-ticker GBM params (volatility, drift, correlation group)
- Tickers outside the curated set fall back to a default GBM parameterization — seed price $100, moderate volatility/drift, no correlation group — so the watchlist accepts any ticker symbol a user or the LLM adds (see §8 `POST /api/watchlist`); there is no closed universe or rejection of "unknown" symbols
- Runs as an in-process background task — no external dependencies

### Massive API (Optional)

- REST API polling (not WebSocket) — simpler, works on all tiers
- Polls for the union of all watched tickers on a configurable interval
- Free tier (5 calls/min): poll every 15 seconds
- Paid tiers: poll every 2-15 seconds depending on tier
- Parses REST response into the same format as the simulator

### Shared Price Cache

- A single background task (simulator or Massive poller) writes to an in-memory price cache
- The cache covers exactly the tickers on the current watchlist — no more, no less
- No hard cap is enforced on watchlist size. For a single-user demo, expected sizes are small (e.g., comfortably under 30 tickers — the default seed is 10), which keeps the per-tick SSE payload size and the simulator's correlation-matrix rebuild cost (triggered on every `add_ticker`/`remove_ticker`) a non-issue by design; this is a deliberate scope decision, not an oversight, so implementing agents shouldn't add defensive limits or worry about scale here
- Adding a ticker to the watchlist registers it in the cache and starts its simulation/polling; removing a ticker deregisters it. Concretely, the watchlist API route (§8 `POST`/`DELETE /api/watchlist`) is the caller: it persists the change to the `watchlist` table *and* calls `MarketDataSource.add_ticker()` / `remove_ticker()` so the cache and SSE stream stay in sync with the persisted watchlist (see §7 Background Tasks for the startup-registration counterpart)
- The cache holds, per ticker, the latest price snapshot: `price`, `previous_price`, and `timestamp`. There is no server-side "session baseline" — see the SSE Streaming and Frontend Design sections for how session change % is derived
- SSE streams read from this cache and push updates to connected clients

### SSE Streaming

- Endpoint: `GET /api/stream/prices`
- Long-lived SSE connection; client uses native `EventSource` API
- The server pushes **one batched event per tick** (~500ms) containing all tracked tickers keyed by symbol — not one event per ticker. Example payload:
  ```
  data: {"AAPL": {"ticker": "AAPL", "price": 190.50, "previous_price": 190.10, "timestamp": 1234567890.123, "change": 0.40, "change_percent": 0.21, "direction": "up"}, "GOOGL": {...}, ...}
  ```
- Per-ticker fields: `ticker`, `price`, `previous_price`, `timestamp`, `change` (absolute price delta from the previous update), `change_percent`, `direction` (`"up"` | `"down"` | `"flat"`)
- The stream updates dynamically as tickers are added to or removed from the watchlist — the keyed object always reflects exactly the current watchlist
- The frontend's `EventSource.onmessage` handler should `JSON.parse(event.data)` into an object and iterate its keys (ticker symbols), not expect a single ticker's fields per message
- Client handles reconnection automatically (EventSource has built-in retry)

---

## 7. Database

### SQLite with Lazy Initialization

The backend checks for the SQLite database on startup (or first request). If the file doesn't exist or tables are missing, it creates the schema and seeds default data. This means:

- No separate migration step
- No manual database setup
- Fresh Docker volumes start with a clean, seeded database automatically

The backend sets `PRAGMA journal_mode=WAL` and a `busy_timeout` on the SQLite connection at startup. This is needed because several independent paths write concurrently within the single async process — trade execution, the 30-second portfolio snapshot task, watchlist CRUD, and chat message persistence — and SQLite's default rollback-journal mode serializes writers tightly enough to surface `database is locked` errors under that load. WAL mode lets readers proceed alongside a single writer and is the standard low-effort fix for this pattern.

### Schema

All tables include a `user_id` column defaulting to `"default"`. This is hardcoded for now (single-user) but enables future multi-user support without schema migration.

**users_profile** — User state (cash balance)
- `id` TEXT PRIMARY KEY (default: `"default"`)
- `cash_balance` REAL (default: `10000.0`)
- `created_at` TEXT (ISO timestamp)

**watchlist** — Tickers the user is watching
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `added_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**positions** — Current holdings (one row per ticker per user)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `quantity` REAL (fractional shares supported)
- `avg_cost` REAL
- `updated_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**Trade execution rules for `avg_cost` and row lifecycle** (weighted-average cost basis):
- **Buy**: `avg_cost` is recomputed as a weighted average of the existing position and the new lot — `(old_qty × old_avg_cost + new_qty × fill_price) / (old_qty + new_qty)`. If no position exists yet, insert a new row with `avg_cost = fill_price`.
- **Sell**: `avg_cost` is **left unchanged** — it reflects the cost basis of the shares that remain. Realized P&L on the sold shares is `(fill_price − avg_cost) × quantity_sold` (informational; not stored in a dedicated column — derivable from the `trades` log if needed later).
- **Full sell (quantity reaches zero)**: the position row is **deleted**. A later buy of the same ticker inserts a fresh row with a clean cost basis rather than blending with the closed-out position.
- **Sell-quantity validation**: compare the requested sell quantity to the held quantity with a small epsilon tolerance (e.g., treat `requested <= held + 1e-9` as valid, and clamp the executed quantity to `held` when within epsilon of it) rather than a strict `<=` comparison. Fractional shares accumulate floating-point error across buys/sells, and a strict comparison would wrongly reject a "sell my whole position" request like selling `10.0` shares of a position that floating-point arithmetic reports as `10.000000000000002`. Treat the position as fully closed (and delete the row, per above) whenever the requested quantity is within epsilon of the held quantity.
- **`cash_balance` precision**: the same floating-point drift applies to `users_profile.cash_balance`, which accumulates across every buy and sell. Round it to 2 decimals on every write (after each trade), so the stored and displayed value is always a clean dollars-and-cents figure rather than e.g. `9999.999999999998`. For the "sufficient cash" check on a buy, compare with the same epsilon tolerance as sell-quantity validation (`cost <= cash_balance + 1e-9`) so a "spend exactly my remaining cash" order isn't spuriously rejected by a strict comparison.

**trades** — Trade history (append-only log)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `side` TEXT (`"buy"` or `"sell"`)
- `quantity` REAL (fractional shares supported)
- `price` REAL
- `executed_at` TEXT (ISO timestamp)

**portfolio_snapshots** — Portfolio value over time (for P&L chart). Recorded every 30 seconds by the snapshot background task, and immediately after each trade execution.
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `total_value` REAL
- `recorded_at` TEXT (ISO timestamp)

**chat_messages** — Conversation history with LLM
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `role` TEXT (`"user"` or `"assistant"`)
- `content` TEXT
- `executed_actions` TEXT (JSON; null for user messages. For assistant messages, stores exactly the `{trades, watchlist_changes, trade_results}` portion of the structured chat response defined in §9 — i.e., the API response shape minus `message`. This is the same object the frontend renders inline as trade/watchlist confirmations, whether freshly returned from `POST /api/chat` or reloaded later via `GET /api/chat/history`)
- `created_at` TEXT (ISO timestamp)

### Default Seed Data

- One user profile: `id="default"`, `cash_balance=10000.0`
- Ten watchlist entries: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX

### Background Tasks

Two independent asyncio tasks are started via FastAPI's lifespan context manager at app startup:

**Market data task** — runs the simulator or Massive poller. Writes prices to the in-memory price cache. Registers the initial watchlist tickers on startup; the watchlist API route registers/deregisters tickers dynamically as the user makes changes by calling into the running source (see §6 Shared Price Cache for the call chain).

**Portfolio snapshot task** — every 30 seconds, reads the current positions from the DB, looks up live prices from the price cache, computes total portfolio value, and inserts a row into `portfolio_snapshots`. Also called directly by the trade execution handler so a snapshot is recorded immediately after each trade.

Both tasks are started in the lifespan context manager and run for the lifetime of the process. Neither task needs to coordinate with the other; they share only the in-memory price cache (read by snapshot, written by market data).

---

## 8. API Endpoints

### Error Conventions

Validation failures across these endpoints — duplicate watchlist ticker (the `(user_id, ticker)` UNIQUE constraint), insufficient cash on a buy, insufficient shares on a sell — return `400` with a JSON body `{"error": "human-readable message"}`. This is the same `error` string shape used in `trade_results` (§9), so manual-trade and chat-driven-trade failures render identically in the UI. `DELETE /api/watchlist/{ticker}` is idempotent: removing a ticker that isn't on the watchlist returns `200` rather than `404` — "already not there" isn't an error condition, and it spares the frontend an existence check before deleting.

### Market Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream/prices` | SSE stream of live price updates |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio` | Current positions, cash balance, total value, unrealized P&L |
| POST | `/api/portfolio/trade` | Execute a trade: `{ticker, quantity, side}` |
| GET | `/api/portfolio/history` | The most recent 500 `portfolio_snapshots` rows (≈4 hours at the 30-second recording interval), oldest-first, for the P&L chart. No query params, no pagination — older snapshots remain in the DB but aren't retrievable via this endpoint |

### Watchlist
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/watchlist` | Current watchlist tickers with latest prices |
| POST | `/api/watchlist` | Add a ticker: `{ticker}`. The route normalizes the ticker (uppercase, whitespace-stripped) before doing anything else with it — this is the single normalization point feeding both the `watchlist` table and `MarketDataSource`, so `"aapl"` and `"AAPL"` resolve to the same row, the same cache entry, and the same curated-vs-default seed parameters (see §6). Any non-empty (post-normalization) ticker symbol is accepted — no validation against a fixed universe (the simulator falls back to default GBM params for unrecognized symbols, see §6); duplicates are rejected via the `(user_id, ticker)` UNIQUE constraint on the normalized value |
| DELETE | `/api/watchlist/{ticker}` | Remove a ticker |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/history` | The most recent 20 messages, oldest-first, with `executed_actions` — the same window used to build LLM context (§9 step 2), reused here for the conversation panel to load on mount. No pagination |
| POST | `/api/chat` | Send a message, receive complete JSON response (message + executed actions + trade results) |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check — returns `200 {"status": "ok"}` if the FastAPI process is up and serving. Does not probe the database, market data task, or LLM reachability (a slow/unreachable LLM shouldn't trigger a Docker restart); used directly by the Dockerfile `HEALTHCHECK` (§11) |

---

## 9. LLM Integration

When writing code to make calls to LLMs, use the `cerebras` skill to call the LLM via LiteLLM through OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. Structured Outputs should be used to interpret the results.

There is an OPENROUTER_API_KEY in the .env file in the project root.

### How It Works

When the user sends a chat message, the backend:

1. Loads the user's current portfolio context (cash, positions with P&L, watchlist with live prices, total portfolio value)
2. Loads the most recent 20 messages (oldest-first) from the `chat_messages` table as conversation history
3. Constructs a prompt with a system message, portfolio context, conversation history, and the user's new message
4. Calls the LLM via LiteLLM → OpenRouter, requesting structured output, using the `cerebras` skill
5. Parses the complete structured JSON response
6. Auto-executes any trades or watchlist changes specified in the response
7. Stores the message and executed actions in `chat_messages` (`executed_actions` column) — this step always runs, whether the LLM call succeeded or hit the fallback path described below, so the persisted conversation always matches what the user saw and the 20-message context window (step 2) never silently skips a turn
8. Returns the complete JSON response to the frontend (no token-by-token streaming — Cerebras inference is fast enough that a loading indicator is sufficient)

**LLM call or parsing failure:** If the LLM call errors, times out, or returns JSON that fails structured-output validation, the backend does **not** surface an HTTP error to the frontend. It instead returns the normal `200` chat response shape with a canned fallback `message` (e.g., "Sorry, I had trouble processing that — please try again") and empty `trades`, `watchlist_changes`, and `trade_results` arrays. This keeps the frontend's response handling uniform — a failed turn renders and persists (per step 7) exactly like any other assistant message, with no special-cased error UI needed.

### Structured Output Schema

The LLM returns JSON matching this schema (the **LLM schema** — what is sent to and received from the model):

```json
{
  "message": "Your conversational response to the user",
  "trades": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10}
  ],
  "watchlist_changes": [
    {"ticker": "PYPL", "action": "add"}
  ]
}
```

- `message` (required): The conversational text shown to the user
- `trades` (optional): Array of trades to auto-execute, capped at 10 per message — the backend processes at most the first 10 and records any beyond that in `trade_results` with `success: false` and an error explaining the cap. Each trade goes through the same validation as manual trades (sufficient cash for buys, sufficient shares for sells). `quantity` supports decimals (fractional shares).
- `watchlist_changes` (optional): Array of watchlist modifications. `action` is one of `"add"` | `"remove"`.

The **API response** returned by `POST /api/chat` extends this with a backend-populated `trade_results` field:

```json
{
  "message": "...",
  "trades": [...],
  "watchlist_changes": [...],
  "trade_results": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10, "success": true, "price": 190.50},
    {"ticker": "TSLA", "side": "buy", "quantity": 100, "success": false, "error": "Insufficient cash"}
  ]
}
```

`trade_results` is always present when `trades` is non-empty; it records the outcome of each attempted execution. On success, `price` is the **fill price** — the live market price read from the price cache at the moment of execution (consistent with "Market orders only... instant fill at current price" in §2); it is not the price the LLM may have referenced when proposing the trade. The frontend renders these inline in the chat as trade confirmations or error notices.

### Auto-Execution

Trades specified by the LLM execute automatically — no confirmation dialog. This is a deliberate design choice:
- It's a simulated environment with fake money, so the stakes are zero
- It creates an impressive, fluid demo experience
- It demonstrates agentic AI capabilities — the core theme of the course

If a trade fails validation (e.g., insufficient cash), the failure is recorded in `trade_results` with `success: false` and an `error` string. The frontend surfaces this inline in the chat so the user can see which trades succeeded and which did not.

### System Prompt Guidance

The LLM should be prompted as "FinAlly, an AI trading assistant" with instructions to:
- Analyze portfolio composition, risk concentration, and P&L
- Suggest trades with reasoning
- Execute trades when the user asks or agrees
- Manage the watchlist proactively
- Be concise and data-driven in responses
- Always respond with valid structured JSON
- **Never guess at an unspecified trade size.** If the user's request lacks a concrete quantity or dollar amount (e.g., "buy some Tesla", "sell a bit of my Apple"), ask a clarifying question in `message` and emit an empty `trades` array — do not auto-execute on a guess. Because trades execute instantly with no confirmation dialog (see Auto-Execution below), guessing is the riskier failure mode for a financial assistant. Only include a trade in `trades` once the user has stated (in this message or earlier in the conversation) a concrete share quantity or a dollar amount to convert to shares at the current price

### LLM Mock Mode

When `LLM_MOCK=true`, the backend returns deterministic mock responses instead of calling OpenRouter. This enables:
- Fast, free, reproducible E2E tests
- Development without an API key
- CI/CD pipelines

---

## 10. Frontend Design

### Layout

The frontend is a single-page application with a dense, terminal-inspired layout. The specific component architecture and layout system is up to the Frontend Engineer, but the UI should include these elements:

- **Watchlist panel** — grid/table of watched tickers with: ticker symbol, current price (flashing green/red on change), session change % computed entirely client-side as `(price - firstSeenPrice) / firstSeenPrice × 100`, where `firstSeenPrice` is the first price the frontend observes for that ticker via SSE after page load (the backend has no session-baseline concept — this mirrors how sparklines accumulate "since page load"), and a sparkline mini-chart (accumulated from SSE since page load)
- **Main chart area** — larger price-over-time chart for the currently selected ticker, built from SSE-accumulated data since page load (starts empty; fills in progressively the same way sparklines do). Clicking a ticker in the watchlist selects it here. The frontend keeps one accumulation buffer per watchlist ticker (the same buffers that feed the sparklines) — switching the selected ticker and switching back simply changes which buffer the main chart displays, with no data loss; nothing is wiped on reselection.
- **Portfolio heatmap** — treemap visualization where each rectangle is a position, sized by portfolio weight, colored by P&L (green = profit, red = loss)
- **P&L chart** — line chart showing total portfolio value over time, using data from `portfolio_snapshots`
- **Positions table** — tabular view of all positions: ticker, quantity, avg cost, current price, unrealized P&L, % change
- **Trade bar** — simple input area: ticker field, quantity field (accepts decimals for fractional shares), buy button, sell button. Market orders, instant fill.
- **AI chat panel** — docked/collapsible sidebar. Loads recent history from `GET /api/chat/history` on mount so the conversation survives a page reload, then appends new messages as they're sent. Message input, scrolling conversation history, loading indicator while waiting for LLM response. Trade executions and watchlist changes shown inline as confirmations (rendered from each message's `executed_actions`).
- **Header** — portfolio total value (updating live), connection status indicator, cash balance

### Technical Notes

- Use `EventSource` for SSE connection to `/api/stream/prices`
- **Lightweight Charts** (TradingView) for all charts — canvas-based, high performance, purpose-built for financial time series
- Price flash effect: on receiving a new price, briefly apply a CSS class with background color transition, then remove it
- All API calls go to the same origin (`/api/*`) — no CORS configuration needed
- Tailwind CSS for styling with a custom dark theme

---

## 11. Docker & Deployment

### Multi-Stage Dockerfile

```
Stage 1: Node 20 slim
  - Copy frontend/
  - npm install && npm run build (produces static export)

Stage 2: Python 3.12 slim
  - Install uv
  - Copy backend/
  - uv sync (install Python dependencies from lockfile)
  - Copy frontend build output into a static/ directory
  - Expose port 8000
  - CMD: uvicorn serving FastAPI app
```

FastAPI serves the static frontend files and all API routes on port 8000.

### Docker Volume

The SQLite database persists via a named Docker volume:

```bash
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

The `db/` directory in the project root maps to `/app/db` in the container. The backend writes `finally.db` to this path.

### Start/Stop Scripts

**`scripts/start_mac.sh`** (macOS/Linux):
- Builds the Docker image if not already built (or if `--build` flag passed)
- Runs the container with the volume mount, port mapping, and `.env` file
- Prints the URL to access the app
- Optionally opens the browser

**`scripts/stop_mac.sh`** (macOS/Linux):
- Stops and removes the running container
- Does NOT remove the volume (data persists)

**`scripts/start_windows.ps1`** / **`scripts/stop_windows.ps1`**: PowerShell equivalents for Windows.

All scripts should be idempotent — safe to run multiple times.

---

## 12. Testing Strategy

### Unit Tests (within `frontend/` and `backend/`)

**Backend (pytest)**:
- Market data: simulator generates valid prices, GBM math is correct, Massive API response parsing works, both implementations conform to the abstract interface
- Portfolio: trade execution logic, P&L calculations, edge cases (selling more than owned, buying with insufficient cash, selling at a loss)
- LLM: structured output parsing handles all valid schemas, graceful handling of malformed responses, trade validation within chat flow
- API routes: correct status codes, response shapes, error handling

**Frontend (React Testing Library or similar)**:
- Component rendering with mock data
- Price flash animation triggers correctly on price changes
- Watchlist CRUD operations
- Portfolio display calculations
- Chat message rendering and loading state

### E2E Tests (in `test/`)

**Infrastructure**: A separate `docker-compose.test.yml` in `test/` that spins up the app container plus a Playwright container. This keeps browser dependencies out of the production image.

**Environment**: Tests run with `LLM_MOCK=true` by default for speed and determinism.

**Key Scenarios**:
- Fresh start: default watchlist appears, $10k balance shown, prices are streaming
- Add and remove a ticker from the watchlist
- Buy shares: cash decreases, position appears, portfolio updates
- Sell shares: cash increases, position updates or disappears
- Portfolio visualization: heatmap renders with correct colors, P&L chart has data points
- AI chat (mocked): send a message, receive a response, trade execution appears inline
- SSE resilience: disconnect and verify reconnection

**Running E2E tests**:

```bash
docker compose -f test/docker-compose.test.yml up --abort-on-container-exit
```

A `scripts/test.sh` wrapper should invoke this command.

