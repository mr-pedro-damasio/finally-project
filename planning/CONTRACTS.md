# FinAlly — Build Contracts

This file is the single source of truth for all inter-agent boundaries. Every
implementing agent MUST follow these contracts exactly. Where this file and
PLAN.md differ on details, this file wins (it is more precise on interfaces).

---

## 1. File Ownership

No two agents may edit the same file. Respect these boundaries strictly.

| Agent      | Owns                                                                                      |
|------------|-------------------------------------------------------------------------------------------|
| frontend   | `frontend/` (all files)                                                                   |
| backend    | `backend/app/main.py`, `backend/app/routes/`, `backend/app/portfolio.py`, `backend/app/services/`, `backend/app/chat_service.py`, `backend/pyproject.toml`, `backend/uv.lock` |
| database   | `backend/app/database.py`, `backend/schema/`                                              |
| llm        | `backend/app/llm.py`                                                                      |
| devops     | `Dockerfile`, `docker-compose.yml`, `.env.example`, `scripts/`                           |
| integration| `test/` (all files)                                                                       |

**Shared read-only** (any agent reads but none owns): `planning/`, `db/`

> **Note on pyproject.toml**: backend owns the file but database and llm agents
> may *request* dependency additions by messaging the backend agent. Backend
> merges them.

---

## 2. Python Module Interfaces

These are the exact function signatures that cross agent boundaries. Implement
them precisely — callers depend on these names and signatures.

### 2.1 Database Module (`backend/app/database.py`)

Owned by **database** agent. Called by **backend** routes and **llm** chat module.

```python
import aiosqlite
from contextlib import asynccontextmanager

# Call once at startup inside FastAPI lifespan
async def init_db() -> None: ...

# User profile
async def get_cash_balance(user_id: str = "default") -> float: ...
async def set_cash_balance(user_id: str, new_balance: float) -> None: ...

# Watchlist
async def get_watchlist(user_id: str = "default") -> list[dict]: ...
# Returns: [{"ticker": str, "added_at": str (ISO)}]
async def add_to_watchlist(user_id: str, ticker: str) -> None: ...
# Raises: ValueError("Ticker already in watchlist") on duplicate
async def remove_from_watchlist(user_id: str, ticker: str) -> None: ...
# Idempotent — no error if ticker not present

# Positions
async def get_positions(user_id: str = "default") -> list[dict]: ...
# Returns: [{"ticker": str, "quantity": float, "avg_cost": float, "updated_at": str}]
async def upsert_position(user_id: str, ticker: str, quantity: float, avg_cost: float) -> None: ...
async def delete_position(user_id: str, ticker: str) -> None: ...

# Trades
async def record_trade(user_id: str, ticker: str, side: str, quantity: float, price: float) -> None: ...

# Portfolio snapshots
async def record_portfolio_snapshot(user_id: str, total_value: float) -> None: ...
async def get_portfolio_history(user_id: str = "default", limit: int = 500) -> list[dict]: ...
# Returns: [{"total_value": float, "recorded_at": str}] oldest-first

# Chat messages
async def save_chat_message(
    user_id: str,
    role: str,
    content: str,
    executed_actions: dict | None = None
) -> None: ...
async def get_chat_history(user_id: str = "default", limit: int = 20) -> list[dict]: ...
# Returns: [{"role": str, "content": str, "executed_actions": dict|None, "created_at": str}] oldest-first
```

All functions use WAL-mode aiosqlite. The DB file path is read from the env var
`DB_PATH`, defaulting to `"db/finally.db"`.

### 2.2 LLM Module (`backend/app/llm.py`)

Owned by **llm** agent. Called by **backend** chat route.

```python
from pydantic import BaseModel

class TradeAction(BaseModel):
    ticker: str
    side: str          # "buy" | "sell"
    quantity: float

class WatchlistAction(BaseModel):
    ticker: str
    action: str        # "add" | "remove"

class ChatResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistAction] = []

async def chat(
    user_message: str,
    history: list[dict],         # [{"role": "user"|"assistant", "content": str}]
    portfolio_context: dict,     # see §3.1 below
) -> ChatResponse: ...
```

When `LLM_MOCK=true` environment variable is set, `chat()` must return a
deterministic `ChatResponse` without calling any external service (used by E2E
tests and CI).

### 2.3 Market Data Interface (`backend/app/market/interface.py`) — ALREADY BUILT

> **This module is complete and has 73 passing tests. Do NOT modify it.**
> Import from `backend.app.market` which exports: `PriceUpdate`, `PriceCache`,
> `MarketDataSource`, `create_market_data_source`, `create_stream_router`.

Usage pattern for backend agent:

```python
from app.market import PriceCache, create_market_data_source, create_stream_router

# At startup:
price_cache = PriceCache()
market_source = create_market_data_source(price_cache)  # picks simulator or Massive via env
initial_tickers = await db.get_watchlist()  # list of {ticker: ...} dicts
await market_source.start([t["ticker"] for t in initial_tickers])

# To stream SSE:
stream_router = create_stream_router(price_cache)
app.include_router(stream_router)

# To read a price:
update = price_cache.get("AAPL")  # returns PriceUpdate or None
all_prices = price_cache.get_all()  # returns dict[str, PriceUpdate]

# Dynamic watchlist:
await market_source.add_ticker("PYPL")
await market_source.remove_ticker("NFLX")
```

---

## 3. Portfolio Context Shape

This dict is passed from the backend chat route into `llm.chat()`.

```python
portfolio_context = {
    "cash": float,           # current cash balance
    "total_value": float,    # cash + sum of position market values
    "positions": [
        {
            "ticker": str,
            "quantity": float,
            "avg_cost": float,
            "current_price": float,
            "unrealized_pnl": float,
            "pnl_percent": float,
        }
    ],
    "watchlist": [
        {
            "ticker": str,
            "price": float,
        }
    ],
}
```

---

## 4. REST API Contracts

All endpoints live under `/api/`. Errors return `400` with `{"error": "message"}`.

### 4.1 GET /api/health
```json
{"status": "ok"}
```

### 4.2 GET /api/stream/prices  (SSE)
Long-lived SSE. One event per tick (~500 ms):
```
data: {
  "AAPL": {"ticker":"AAPL","price":190.50,"previous_price":190.10,
           "timestamp":1234567890.123,"change":0.40,"change_percent":0.21,"direction":"up"},
  "GOOGL": {...}
}
```

### 4.3 GET /api/watchlist
```json
[
  {"ticker":"AAPL","price":190.5,"previous_price":190.1,"change":0.4,"change_percent":0.21,"added_at":"2024-01-01T00:00:00"}
]
```

### 4.4 POST /api/watchlist
Request: `{"ticker": "AAPL"}`
Success `200`: `{"ticker":"AAPL","added_at":"2024-01-01T00:00:00"}`
Error `400`: `{"error":"Ticker already in watchlist"}`

### 4.5 DELETE /api/watchlist/{ticker}
Always `200`: `{"ticker":"AAPL","removed":true}`

### 4.6 GET /api/portfolio
```json
{
  "cash_balance": 10000.0,
  "total_value": 10000.0,
  "positions": [
    {
      "ticker": "AAPL",
      "quantity": 10.0,
      "avg_cost": 185.0,
      "current_price": 190.0,
      "unrealized_pnl": 50.0,
      "pnl_percent": 2.70
    }
  ]
}
```

### 4.7 POST /api/portfolio/trade
Request: `{"ticker":"AAPL","quantity":10,"side":"buy"}`
Success `200`:
```json
{"success":true,"ticker":"AAPL","side":"buy","quantity":10,"price":190.50}
```
Error `400`: `{"error":"Insufficient cash"}`

### 4.8 GET /api/portfolio/history
```json
[{"total_value":10000.0,"recorded_at":"2024-01-01T00:00:00"}]
```
(most recent 500 rows, oldest-first)

### 4.9 GET /api/chat/history
```json
[
  {"role":"user","content":"Buy 10 AAPL","executed_actions":null,"created_at":"..."},
  {"role":"assistant","content":"Done!","executed_actions":{"trades":[...],"watchlist_changes":[],"trade_results":[...]},"created_at":"..."}
]
```
(most recent 20 messages, oldest-first)

### 4.10 POST /api/chat
Request: `{"message":"Buy 10 shares of AAPL"}`
Response `200`:
```json
{
  "message": "I've bought 10 shares of AAPL at $190.50.",
  "trades": [{"ticker":"AAPL","side":"buy","quantity":10}],
  "watchlist_changes": [],
  "trade_results": [
    {"ticker":"AAPL","side":"buy","quantity":10,"success":true,"price":190.50}
  ]
}
```
On LLM failure (any error): return `200` with canned `message`, empty arrays.

---

## 5. Database Schema

See PLAN.md §7 for authoritative field definitions. Reproduced here for
quick reference:

```sql
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY DEFAULT 'default',
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    executed_actions TEXT,
    created_at TEXT NOT NULL
);
```

Seed data (inserted only when DB is freshly created):
- `users_profile`: id=`"default"`, cash_balance=`10000.0`
- `watchlist`: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX (all user_id=`"default"`)

---

## 6. Frontend ↔ Backend Boundary

- All API calls use relative paths (`/api/...`) — no CORS, same origin.
- SSE: `new EventSource('/api/stream/prices')`
- The frontend NEVER talks to the database directly.
- All amounts are floats; the frontend formats them for display.
- Session change % is computed client-side: `(price - firstSeenPrice) / firstSeenPrice * 100` where `firstSeenPrice` is the first SSE price observed per ticker after page load.

---

## 7. Environment Variables

```
OPENROUTER_API_KEY=   # Required for live LLM calls
MASSIVE_API_KEY=      # Optional; empty → use simulator
LLM_MOCK=false        # Set to "true" for deterministic E2E test responses
DB_PATH=db/finally.db # Optional override
```

---

## 8. Key Invariants (all agents enforce)

1. `cash_balance` is always rounded to 2 decimal places on write.
2. Epsilon tolerance `1e-9` for sell-quantity and cash-sufficiency comparisons.
3. Full sell (qty within epsilon of held) deletes the position row.
4. `avg_cost` is never changed on a sell — only recalculated on buy.
5. Watchlist tickers are stored and looked up as UPPERCASE, whitespace-stripped.
6. Trade cap in chat: at most first 10 LLM-requested trades are executed; extras recorded as `success: false`.
7. Portfolio snapshots are recorded every 30 s AND immediately after each trade.
