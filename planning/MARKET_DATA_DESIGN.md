# Market Data Backend — Design Document

How FinAlly turns "a ticker symbol" into "a smooth, believable, live-updating price" — and how it does that identically whether the price comes from a math model or a real exchange feed.

Everything described here lives under `backend/app/market/`.

---

## Table of Contents

1. [Why This Subsystem Exists](#1-why-this-subsystem-exists)
2. [Guiding Principles](#2-guiding-principles)
3. [Architecture at a Glance](#3-architecture-at-a-glance)
4. [The Contract: `MarketDataSource`](#4-the-contract-marketdatasource)
5. [`PriceUpdate`: the Wire Format](#5-priceupdate-the-wire-format)
6. [`PriceCache`: Single Source of Truth](#6-pricecache-single-source-of-truth)
7. [Building the Simulator](#7-building-the-simulator)
8. [Building the Massive API Client](#8-building-the-massive-api-client)
9. [The Factory: One Switch, Two Paths](#9-the-factory-one-switch-two-paths)
10. [Wiring Into FastAPI](#10-wiring-into-fastapi)
11. [Streaming to the Browser: the SSE Endpoint](#11-streaming-to-the-browser-the-sse-endpoint)
12. [Watchlist Coordination](#12-watchlist-coordination)
13. [Anatomy of a Tick: an End-to-End Walkthrough](#13-anatomy-of-a-tick-an-end-to-end-walkthrough)
14. [Testing Strategy](#14-testing-strategy)
15. [Configuration & Tuning Reference](#15-configuration--tuning-reference)
16. [Troubleshooting Runbook](#16-troubleshooting-runbook)
17. [Extension Points](#17-extension-points)

---

## 1. Why This Subsystem Exists

§6–7 of `PLAN.md` set the constraints this subsystem has to satisfy:

- The watchlist must show **live-updating prices** at roughly 2 ticks/second, with enough history that sparklines and the main chart can fill in progressively.
- The data must come from **one of two places** — a built-in simulator (default, zero config) or the Massive (Polygon.io) REST API (if `MASSIVE_API_KEY` is set) — and the rest of the app must not care which.
- It has to run as **an in-process background task** inside a single-container deployment — no message queues, no external workers, no Redis.
- It feeds three independent consumers: the **SSE stream** to the browser, **trade execution** (fill price), and the **portfolio snapshot task** (valuation).

In short: one component has to *produce* prices on its own schedule (every 500ms for the simulator, every 15s for Massive) and *serve* them on a completely different schedule (the SSE loop's 500ms cadence, or an instantaneous read at trade time). That impedance mismatch — different producers, different consumers, different cadences, all sharing one process — is the central design problem this document solves.

## 2. Guiding Principles

These four ideas shape every decision below:

1. **Source-agnostic downstream.** Nothing outside `app/market/` should ever import `SimulatorDataSource` or `MassiveDataSource` by name, or branch on which one is active. They satisfy one interface; everyone else codes against that interface.
2. **Push, not pull.** Data sources write into a shared cache *on their own schedule*. Consumers read the cache *on their own schedule*. Neither side blocks on the other, and neither side needs to know the other's timing.
3. **One mutable thing.** The `PriceCache` is the only piece of shared, mutable state in the subsystem. Everything else — `PriceUpdate`, the simulator's internal arrays, the Massive client's snapshot objects — is either immutable or privately owned by a single task.
4. **Fail soft, log loud.** A bad tick, a 429 from the API, a malformed snapshot — none of these should ever take down the background task or the app. They get logged and the loop continues. Stale data beats a crashed dashboard.

## 3. Architecture at a Glance

```
   .env: MASSIVE_API_KEY?
            │
            ▼
  ┌──────────────────────┐         set?  ┌──────────────────────┐
  │ create_market_data_  │──── yes ─────▶│   MassiveDataSource   │── polls every 15s ──┐
  │ source()  (factory)  │               │  (REST, real prices)  │                     │
  └──────────┬───────────┘               └──────────────────────┘                     │
             │ no                                                                       │
             ▼                                                                          │
  ┌──────────────────────┐                                                              │
  │  SimulatorDataSource  │── ticks every 500ms ────────────────────────────────────────┤
  │  (GBM, fabricated)    │                                                              │
  └──────────────────────┘                                                              │
                                                                                         ▼
                                                                          ┌───────────────────────────┐
                                                                          │       PriceCache           │
                                                                          │ thread-safe, versioned,    │
                                                                          │ {ticker: PriceUpdate}      │
                                                                          └─────────────┬─────────────┘
                                                                                        │ reads
                                              ┌────────────────────────┬────────────────┴──┬───────────────────────────┐
                                              ▼                        ▼                    ▼
                                  GET /api/stream/prices    POST /api/portfolio/trade   Portfolio snapshot task
                                  (poll cache @ 500ms,       (read fill price at the     (every 30s, read price for
                                   push to EventSource)       instant of execution)       each held position)
```

Both `SimulatorDataSource` and `MassiveDataSource` implement `MarketDataSource` and are the *only* two things that ever call `PriceCache.update()`. Everything to the right of the cache only ever calls `get`, `get_all`, `get_price`, or reads `version` — it never knows or cares which data source is feeding it.

### File layout

```
backend/app/market/
├── __init__.py        # Public re-exports — the only import surface for the rest of the app
├── models.py          # PriceUpdate — the immutable value object that crosses the cache boundary
├── interface.py       # MarketDataSource — the ABC both sources implement
├── cache.py           # PriceCache — the shared, thread-safe, versioned store
├── seed_prices.py     # Pure data: starting prices, per-ticker GBM params, correlation groups
├── simulator.py       # GBMSimulator (math engine) + SimulatorDataSource (async wrapper)
├── massive_client.py  # MassiveDataSource — REST polling client
├── factory.py         # create_market_data_source() — env-driven selection
└── stream.py          # SSE router factory for GET /api/stream/prices
```

Each module has exactly one job. `seed_prices.py` is deliberately inert — constants only — so that both `simulator.py` and any future data source can read from it without pulling in async machinery or numpy.

## 4. The Contract: `MarketDataSource`

```python
# interface.py
class MarketDataSource(ABC):
    @abstractmethod
    async def start(self, tickers: list[str]) -> None: ...

    @abstractmethod
    async def stop(self) -> None: ...

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None: ...

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None: ...

    @abstractmethod
    def get_tickers(self) -> list[str]: ...
```

Five methods. That's the entire surface a data source has to expose, and it maps directly onto the only things that ever need to happen to one over its lifetime: *spin up* (with an initial ticker set pulled from the `watchlist` table), *track new symbols* and *stop tracking old ones* as the user edits their watchlist, *report what it's tracking* (useful for diagnostics and for `__len__`-style checks), and *spin down* cleanly at shutdown.

### Why push, not pull?

An alternative design would have `MarketDataSource` expose a `get_price(ticker) -> float` method that consumers call directly — a pull model. That seems simpler at first glance, but it quietly couples the consumer to the producer's timing: a pull on `MassiveDataSource` would either block for up to 15 seconds (bad) or return cached data anyway (in which case, why not just read a cache directly?).

The push model sidesteps this entirely. A data source's job is reduced to "periodically call `cache.update(ticker, price)`." It runs on whatever cadence makes sense for *it* — 500ms for a CPU-bound simulation step, 15s for a rate-limited REST poll — and the `PriceCache` absorbs the difference. The SSE loop, in turn, reads the cache on *its own* cadence (500ms, matching the frontend's sparkline accumulation rate) regardless of how often the underlying source actually changed the data. Three independent clocks, zero coordination required.

### Lifecycle as a small state machine

```
   created ──start(tickers)──▶ running ──add_ticker()/remove_ticker()──▶ running
                                  │
                                  └────────────stop()────────────▶ stopped
```

The interface's docstring is explicit that `start()` is called exactly once and `stop()` is idempotent — both implementations honor this by guarding their background-task handle (`if self._task and not self._task.done()`) before cancelling, so a double-`stop()` during, say, an exception-driven shutdown path never raises.

## 5. `PriceUpdate`: the Wire Format

```python
# models.py
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker, "price": self.price,
            "previous_price": self.previous_price, "timestamp": self.timestamp,
            "change": self.change, "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

This is the *only* type that crosses from the market-data layer into the rest of the app. Three choices are worth calling out:

- **`frozen=True, slots=True`.** At ~2 updates/second × N tickers, the app mints a fresh `PriceUpdate` on every tick for every ticker — potentially thousands per minute. `slots=True` drops the per-instance `__dict__`, and `frozen=True` means a `PriceUpdate` handed to one task can be safely read by another without copying or locking — there's nothing to mutate.
- **Derive, don't store.** `change`, `change_percent`, and `direction` are computed properties, not stored fields. A naive design might compute `direction` once at creation time and stash it — but then it's possible (through a bug, a refactor, anything) for `direction` to disagree with `price` and `previous_price`. Making them properties makes that class of bug *impossible*: there is exactly one source of truth (`price` and `previous_price`), and everything else is a pure function of it.
- **`to_dict()` is the single serialization chokepoint.** Both the SSE stream (§11) and any future REST endpoint that needs to return price data serialize through this one method. If the wire format ever needs a new field, there's exactly one place to add it.

## 6. `PriceCache`: Single Source of Truth

```python
# cache.py
class PriceCache:
    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        with self._lock:
            ts = timestamp or time.time()
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price

            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        with self._lock:
            return dict(self._prices)          # shallow copy — safe to iterate outside the lock

    def get_price(self, ticker: str) -> float | None:
        update = self.get(ticker)
        return update.price if update else None

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        return self._version
```

### Why a `threading.Lock`, not an `asyncio.Lock`?

This looks backwards at first — the app is async, so why reach for a synchronous primitive? Because **not all writers run on the event loop**. `MassiveDataSource` offloads its blocking REST call to `asyncio.to_thread()`, which executes in a real OS thread from the default executor — `asyncio.Lock` provides no protection there; it's only safe to acquire from the loop that created it. A `threading.Lock` is the one primitive that's correctly acquirable from *both* a coroutine running on the event loop (the simulator's `_run_loop`, the SSE generator) *and* a worker thread (the Massive poll). The critical sections are also tiny — a dict lookup and an assignment — so contention is a non-issue at this scale (§13.4 of the original review estimated negligible contention at 10 tickers / 2 ticks/sec; that reasoning still holds).

### Why a version counter?

The naive SSE loop would be: "every 500ms, serialize and push everything in the cache." That works, but it means the simulator path sends ~2 identical-looking payloads per second even when nothing material changed, *and* — more importantly — it means a Massive-backed deployment (which only updates every 15 seconds) would push 30 redundant copies of the same snapshot before the underlying data actually moves.

`_version` is a monotonically increasing counter bumped on every `update()`. The SSE loop remembers the last version it sent and skips the push entirely if nothing has changed:

```python
last_version = -1
while True:
    if price_cache.version != last_version:
        last_version = price_cache.version
        yield format_sse(price_cache.get_all())
    await asyncio.sleep(0.5)
```

This makes the cache *self-describing about staleness* — the SSE layer never needs to know the polling interval of whichever source is active; it just asks "did anything change since I last looked?"

### Read/write asymmetry by design

Note that `get`, `get_all`, and `get_price` all acquire the lock briefly and return either an immutable `PriceUpdate` or a shallow-copied `dict` of them. Because `PriceUpdate` is frozen, the caller can hold onto and iterate that snapshot for as long as it likes without the lock — there's no danger of "torn reads" or the underlying data changing out from under an iteration in progress. This is what makes `get_all()` cheap to call from the SSE loop on every tick: the copy is O(tickers) — bounded at "comfortably under 30" per `PLAN.md` §6 — and the lock is held only for the duration of that copy, not for the JSON serialization that follows.

## 7. Building the Simulator

The simulator has to satisfy a deceptively hard brief: produce price movement that *looks* like a real market — continuous, never negative, with sector co-movement and the occasional dramatic spike — using nothing but `numpy` and a clock. **Geometric Brownian Motion (GBM)** is the standard answer to "how do I generate a realistic-looking stock price path"; it's the same lognormal model underlying Black-Scholes.

### 7.1 The math, derived

GBM says a price evolves as:

```
S(t+dt) = S(t) · exp[ (μ − σ²/2)·dt + σ·√dt·Z ]
```

| Symbol | Meaning |
|---|---|
| `S(t)` | current price |
| `μ` (mu) | annualized drift — the "expected direction" of the stock |
| `σ` (sigma) | annualized volatility — how wildly it swings |
| `dt` | the time step, expressed as a *fraction of a trading year* |
| `Z` | a draw from the standard normal distribution `N(0, 1)` |

The `exp(...)` wrapper is what guarantees **prices can never go negative** — no matter how unlucky the random draw, multiplying a positive price by `e^x` always yields a positive price. This is GBM's killer feature over a naive additive random walk (`price += noise`), which can and eventually will wander below zero.

Because updates happen every 500ms and a trading year has roughly `252 days × 6.5 hours × 3600 seconds = 5,896,800` seconds, each tick represents:

```python
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600       # 5,896,800
DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR       # ≈ 8.48 × 10⁻⁸
```

Plugging a `dt` this tiny into the formula produces sub-cent moves on any single tick — which is exactly right. Realistic intraday volatility doesn't come from any one tick being dramatic; it comes from thousands of small, directionally-biased nudges accumulating into a visible trend over minutes.

### 7.2 Correlated moves: tech stocks don't move alone

Drawing an independent `Z` for every ticker would make AAPL and MSFT move in totally unrelated directions tick to tick — which doesn't match how real markets behave (a Fed announcement moves the whole sector). The fix is to draw correlated normals instead of independent ones, via **Cholesky decomposition** of a correlation matrix `C`:

```
L = cholesky(C)            # lower-triangular "square root" of C
Z_correlated = L @ Z_independent
```

If `Z_independent` is a vector of independent `N(0,1)` draws, `Z_correlated` is a vector whose *pairwise correlations* match `C` exactly. This is the standard technique for simulating correlated random variables, and it's mathematically guaranteed to work as long as `C` is a valid (symmetric, positive-semi-definite) correlation matrix — which a matrix built from `{-1 ≤ ρ ≤ 1}` pairwise coefficients with a unit diagonal always is.

The correlation structure itself is sector-based and deliberately simple:

| Pair | ρ | Rationale |
|---|---|---|
| Two tech names (AAPL/GOOGL/MSFT/AMZN/META/NVDA/NFLX) | 0.6 | Tech sentiment moves as a block |
| Two finance names (JPM/V) | 0.5 | Same — financials move together |
| Either side is TSLA | 0.3 | TSLA is famously idiosyncratic — "does its own thing" |
| Anything else (cross-sector, unknown tickers) | 0.3 | Mild baseline co-movement; markets aren't fully segmented |

```python
@staticmethod
def _pairwise_correlation(t1: str, t2: str) -> float:
    if t1 == "TSLA" or t2 == "TSLA":
        return TSLA_CORR
    if t1 in CORRELATION_GROUPS["tech"] and t2 in CORRELATION_GROUPS["tech"]:
        return INTRA_TECH_CORR
    if t1 in CORRELATION_GROUPS["finance"] and t2 in CORRELATION_GROUPS["finance"]:
        return INTRA_FINANCE_CORR
    return CROSS_GROUP_CORR
```

The matrix — and its Cholesky factor — is rebuilt whenever the tracked-ticker set changes (`add_ticker`/`remove_ticker`), since both its dimensions and its pairwise entries depend on *which* tickers are present. This is `O(n²)`, but `n` is small by design (`PLAN.md` explicitly scopes the watchlist to "comfortably under 30" — see §6 of the plan, "deliberate scope decision, not an oversight"), so a full rebuild on every watchlist edit is cheap enough to do synchronously.

> **Note on single-ticker correlation:** with fewer than two tickers there's no pairwise correlation to speak of — `_rebuild_cholesky` short-circuits to `self._cholesky = None`, and `step()` falls back to using the independent draws directly (`z_correlated = z_independent`). No special-casing needed beyond that one `if`.

### 7.3 Shock events — keeping the dashboard alive

GBM with a microscopic `dt` produces price paths that are realistic but, on a short demo timescale, can look *too* smooth — nothing dramatic ever seems to happen. To counter that, every tick gives every ticker a small independent chance of a sudden 2–5% jump in either direction:

```python
if random.random() < self._event_prob:           # default: 0.001 (0.1%)
    shock_magnitude = random.uniform(0.02, 0.05)
    shock_sign = random.choice([-1, 1])
    self._prices[ticker] *= 1 + shock_magnitude * shock_sign
```

At `event_probability = 0.001` and ~2 ticks/second, a single ticker sees a shock roughly once every 500 seconds (`1 / (0.001 × 2)`). With 10 tickers in the default watchlist, that means a shock *somewhere* roughly every 50 seconds — frequent enough that anyone watching the dashboard for a minute will see at least one dramatic flash, without the market feeling chaotic.

### 7.4 Seed data: starting somewhere believable

`seed_prices.py` is pure data — three dictionaries and five scalar constants, no logic:

```python
SEED_PRICES = {"AAPL": 190.00, "GOOGL": 175.00, "MSFT": 420.00, ...}   # realistic 2025-era prices
TICKER_PARAMS = {
    "TSLA": {"sigma": 0.50, "mu": 0.03},   # high volatility — matches its real-world reputation
    "JPM":  {"sigma": 0.18, "mu": 0.04},   # low volatility — banks are "boring" by comparison
    "NVDA": {"sigma": 0.40, "mu": 0.08},   # high volatility *and* strong upward drift
    ...
}
DEFAULT_PARAMS = {"sigma": 0.25, "mu": 0.05}   # fallback for tickers outside the curated set
```

Two things matter here. First, **`SEED_PRICES` only covers the curated default watchlist** — `PLAN.md` §6 is explicit that the simulator must accept *any* ticker symbol the user or the LLM adds, with no closed universe. Tickers outside the curated set get a seed price drawn uniformly from `$50–$300` and the `DEFAULT_PARAMS` volatility/drift — "moderate," not tuned, because there's no real-world reference to tune against. Second, **the per-ticker `sigma`/`mu` values are chosen to match each company's real-world reputation** — TSLA and NVDA run hot, JPM and V run cool — which is a small touch that makes the simulated market *feel* like the real one to anyone who recognizes the tickers.

### 7.5 Putting it together: `GBMSimulator.step()`

```python
def step(self) -> dict[str, float]:
    n = len(self._tickers)
    if n == 0:
        return {}

    z_independent = np.random.standard_normal(n)
    z_correlated = self._cholesky @ z_independent if self._cholesky is not None else z_independent

    result = {}
    for i, ticker in enumerate(self._tickers):
        sigma, mu = self._params[ticker]["sigma"], self._params[ticker]["mu"]
        drift = (mu - 0.5 * sigma**2) * self._dt
        diffusion = sigma * math.sqrt(self._dt) * z_correlated[i]
        self._prices[ticker] *= math.exp(drift + diffusion)

        if random.random() < self._event_prob:
            shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
            self._prices[ticker] *= 1 + shock

        result[ticker] = round(self._prices[ticker], 2)
    return result
```

This is the **hot path** — called roughly twice a second for the lifetime of the process — so it's written to do the minimum necessary work: one batched `numpy` draw for all tickers (rather than `n` separate calls into the RNG), one matrix-vector multiply, then a tight per-ticker loop doing scalar arithmetic. There is no I/O, no logging on the happy path (the random-event log line is `debug`-level, off by default), and no allocation beyond the output dict.

### 7.6 `SimulatorDataSource`: wrapping the math in a lifecycle

`GBMSimulator` is a pure, synchronous math engine with no notion of *when* it should run. `SimulatorDataSource` is the thin async shell that satisfies `MarketDataSource` by driving it on a clock:

```python
class SimulatorDataSource(MarketDataSource):
    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        for ticker in tickers:                                  # seed the cache *before* the loop starts
            if (price := self._sim.get_price(ticker)) is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def _run_loop(self) -> None:
        while True:
            try:
                if self._sim:
                    for ticker, price in self._sim.step().items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)
```

Two details earn their keep:

- **Seed-then-loop.** The cache is populated with starting prices *synchronously*, before `_run_loop` is even scheduled. Without this, the very first SSE push (which can race the first simulator tick) would have nothing to send, and the watchlist would render as a blank flash before filling in. Seeding eagerly means there is *never* a frame with missing data.
- **Catch, log, continue.** The `try/except Exception` inside the loop body — not around it — means a single bad step (a `numpy` hiccup, an unexpected `None`) gets logged via `logger.exception` (full traceback) and the loop carries on to the next tick. The alternative — letting the exception propagate — would silently kill the background task, and the dashboard would freeze with no indication why. A long-running service must never let one bad iteration become a permanent outage.

## 8. Building the Massive API Client

When `MASSIVE_API_KEY` is present, `MassiveDataSource` replaces the simulator with real quotes from Polygon.io's REST API (rebranded "Massive"). The brief here is shaped entirely by **rate limits**: the free tier allows 5 requests/minute, so naive per-ticker polling is a non-starter — at 10 tickers that's two full polling cycles' worth of quota burned on a single tick.

### 8.1 One call, many tickers

The snapshot-all endpoint accepts a comma-separated ticker list and returns current data for all of them in a single response:

```python
snapshots = client.get_snapshot_all(
    market_type=SnapshotMarketType.STOCKS,
    tickers=self._tickers,           # ["AAPL", "GOOGL", "MSFT", ...] — one call for all of them
)
```

This is what makes polling viable on the free tier at all: one request per poll cycle, regardless of watchlist size (within the "comfortably under 30" scope `PLAN.md` sets). At the default 15-second interval, that's 4 requests/minute — comfortably under the 5/minute ceiling.

### 8.2 The poll loop

```python
class MassiveDataSource(MarketDataSource):
    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = list(tickers)
        await self._poll_once()                                   # don't wait 15s for the first quote
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        if not self._tickers or not self._client:
            return
        try:
            snapshots = await asyncio.to_thread(self._fetch_snapshots)
            for snap in snapshots:
                try:
                    self._cache.update(
                        ticker=snap.ticker,
                        price=snap.last_trade.price,
                        timestamp=snap.last_trade.timestamp / 1000.0,   # ms → seconds
                    )
                except (AttributeError, TypeError) as e:
                    logger.warning("Skipping snapshot for %s: %s", getattr(snap, "ticker", "???"), e)
        except Exception as e:
            logger.error("Massive poll failed: %s", e)   # keep the loop alive — retry next interval
```

Why `asyncio.to_thread`? The official `massive` Python client is **synchronous** — calling it directly from a coroutine would block the entire event loop (and every SSE connection, every API request, everything) for the duration of the HTTP round trip. Offloading it to a worker thread via `asyncio.to_thread()` keeps the loop responsive; this is also *why* `PriceCache` needs a `threading.Lock` rather than an `asyncio.Lock` (§6) — the write that follows happens on that worker thread.

### 8.3 An immediate first poll

Note that `start()` calls `_poll_once()` directly — *before* the polling task is even created. Without this, a fresh deployment with a Massive key would show a blank watchlist for up to 15 seconds after startup. One eager poll closes that gap, mirroring the simulator's eager-seed behavior (§7.6) — both paths guarantee the cache has data the instant the app finishes starting up.

### 8.4 Error handling philosophy

A REST poller talking to a third-party API over the open internet *will* occasionally fail — bad keys, rate limits, network blips, malformed payloads. The design treats every one of these as **recoverable**:

| Failure | What happens | Why this is right |
|---|---|---|
| **401 Unauthorized** (bad/missing key) | Logged as error; loop keeps running | The user can fix `.env` and restart without redeploying; crashing the task would mean the *simulator* never takes over either, since the factory already committed to Massive |
| **429 Too Many Requests** | Logged as error; next attempt waits a full `poll_interval` | Backing off to the configured interval is simpler than exponential backoff and matches "poll on a timer" from `PLAN.md` §6 |
| **Network timeout / 5xx** | Logged as error; retried automatically next cycle | Transient — the next poll is seconds away regardless |
| **Malformed snapshot for one ticker** | That ticker's `AttributeError`/`TypeError` is caught and logged at `warning`; the rest of the batch is still processed | One bad record (e.g., a delisted symbol with no `last_trade`) shouldn't blank out nine good ones |
| **Every ticker fails** | Cache simply isn't updated this cycle — it retains the last-known prices | Stale-but-present data lets the dashboard keep functioning; the `version` counter (§6) just doesn't bump, so SSE correctly sends nothing new |

The outermost `try/except Exception` in `_poll_once` and the per-snapshot `try/except (AttributeError, TypeError)` form two concentric safety nets: one protects the loop from total failure, the other protects a healthy batch from one corrupt record.

### 8.5 Lazy dependency, eager validation

The original interface sketch imported `massive` lazily, *inside* `start()`, specifically so students without an API key would never need the package installed. In the shipped implementation the import sits at module level (`from massive import RESTClient`), and `pyproject.toml` declares `massive` as a core dependency — a deliberate trade documented in `MARKET_DATA_SUMMARY.md`'s fix list ("Lazy imports removed — `massive` is a core dependency"). The simulator path remains dependency-light regardless (only `numpy` beyond stdlib); `massive` simply ships with every install rather than being conditionally available, trading a slightly larger image for simpler, more predictable imports and patchable test seams.

## 9. The Factory: One Switch, Two Paths

```python
def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
    if api_key:
        logger.info("Market data source: Massive API (real data)")
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
```

This function is the **entire decision point** for "where do prices come from" in the whole application. It's called exactly once, at startup, from the FastAPI lifespan handler (§10). Notice what it does *not* do: it doesn't validate the key, doesn't make a test API call, doesn't return a union type the caller has to discriminate. It returns an unstarted `MarketDataSource` — the caller's job is just to `await source.start(tickers)`. Whichever branch is taken, the remaining 99% of the app's code is identical from this point forward, which is the entire point of the strategy pattern: **the choice is made in exactly one place, and nowhere else needs to know it was made.**

The `.strip()` matters more than it looks: an `.env` file with `MASSIVE_API_KEY=` (present but empty) or `MASSIVE_API_KEY=   ` (whitespace) must fall through to the simulator, not attempt — and fail — to construct a REST client with a blank key.

## 10. Wiring Into FastAPI

The subsystem's startup and shutdown are pinned to the application's own lifecycle via FastAPI's `lifespan` context manager — the same mechanism that starts the portfolio-snapshot background task described in `PLAN.md` §7.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    price_cache = PriceCache()
    source = create_market_data_source(price_cache)
    initial_tickers = await load_watchlist_tickers()      # SELECT ticker FROM watchlist
    await source.start(initial_tickers)

    app.state.price_cache = price_cache
    app.state.market_source = source
    app.include_router(create_stream_router(price_cache))

    yield   # ───────────── app serves requests ─────────────

    # --- shutdown ---
    await source.stop()


app = FastAPI(lifespan=lifespan)
```

Storing the cache and source on `app.state` (rather than as module-level globals) is what makes them reachable through FastAPI's dependency-injection system from any router, without import cycles:

```python
def get_price_cache(request: Request) -> PriceCache:
    return request.app.state.price_cache

def get_market_source(request: Request) -> MarketDataSource:
    return request.app.state.market_source

@router.post("/portfolio/trade")
async def execute_trade(trade: TradeRequest, cache: PriceCache = Depends(get_price_cache)):
    fill_price = cache.get_price(trade.ticker)
    if fill_price is None:
        raise HTTPException(400, f"Price not yet available for {trade.ticker}")
    # ... execute at fill_price — see PLAN.md §9 on trade_results.price semantics ...
```

Two correctness properties fall out of this wiring "for free": **the source starts with exactly the persisted watchlist** (no hardcoded ticker list drifting out of sync with the database), and **shutdown is guaranteed** — `await source.stop()` runs even if the app is shutting down because of an unhandled exception elsewhere, since it's in the `finally`-equivalent position of the context manager.

## 11. Streaming to the Browser: the SSE Endpoint

```python
def create_stream_router(price_cache: PriceCache) -> APIRouter:
    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(
            _generate_events(price_cache, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",     # tell any reverse proxy not to buffer the stream
            },
        )
    return router


async def _generate_events(price_cache: PriceCache, request: Request, interval: float = 0.5):
    yield "retry: 1000\n\n"                   # browser auto-reconnect delay, in ms

    last_version = -1
    while True:
        if await request.is_disconnected():
            break

        if price_cache.version != last_version:
            last_version = price_cache.version
            prices = price_cache.get_all()
            if prices:
                yield f"data: {json.dumps({t: u.to_dict() for t, u in prices.items()})}\n\n"

        await asyncio.sleep(interval)
```

### Why SSE, and why poll-and-push instead of event-driven?

`PLAN.md` §3 already settles "SSE vs. WebSockets" in favor of SSE — the data only ever flows server→client, so a full duplex protocol buys nothing but complexity. What's worth elaborating on here is the *internal* design choice: this generator polls `price_cache.version` on a fixed interval rather than being notified the instant a price changes (e.g., via an `asyncio.Condition` the cache signals on every `update()`).

Polling wins for two reasons specific to this app:

1. **Predictable cadence beats minimal latency.** The frontend accumulates incoming ticks into sparkline buffers (`PLAN.md` §10) — evenly-spaced samples produce clean, readable charts; bursty event-driven pushes (e.g., three Massive-poll updates landing in the same instant, then 15 seconds of silence) would produce lumpy, harder-to-read visualizations for no benefit, since human perception can't distinguish a 50ms latency improvement on a stock ticker anyway.
2. **It naturally batches.** One poll, one serialization pass, one `data:` line covering every tracked ticker — exactly the wire format `PLAN.md` §6 specifies (a single keyed object per tick, not one event per ticker). An event-driven design would need an explicit debounce/coalescing layer to achieve the same batching; the polling loop gets it by construction.

### The wire format

```
retry: 1000

data: {"AAPL":{"ticker":"AAPL","price":190.50,"previous_price":190.42,"timestamp":1751875200.5,"change":0.08,"change_percent":0.042,"direction":"up"},"GOOGL":{...}}

```

The browser side is almost insultingly simple — `EventSource` handles reconnection natively, so the entire client contract is "parse JSON, iterate keys":

```javascript
const es = new EventSource('/api/stream/prices');
es.onmessage = (event) => {
  const updates = JSON.parse(event.data);          // { "AAPL": {...}, "GOOGL": {...}, ... }
  for (const [ticker, update] of Object.entries(updates)) {
    applyPriceUpdate(ticker, update);               // flash the cell, push onto the sparkline buffer
  }
};
```

### Disconnection is the steady state, not the exception

Two distinct disconnection paths are handled, deliberately differently:

- **Client goes away:** `await request.is_disconnected()` is checked at the top of every loop iteration. The moment it returns `True`, the generator returns — FastAPI tears down the response, the connection closes cleanly, and the loop simply stops being driven (there's no per-client task to cancel; the generator *is* the per-client state).
- **Server cancels the stream** (app shutdown, worker recycle): the `try/except asyncio.CancelledError` around the loop body logs the cancellation and lets it propagate, so the `StreamingResponse` machinery can finish tearing down the connection.

The `retry: 1000\n\n` directive at the top of the stream is what makes "client goes away and comes back" a non-event from the server's perspective: the browser's native `EventSource` reconnects on its own, 1 second later, and simply opens a brand-new generator instance — no server-side reconnection logic to write or test.

## 12. Watchlist Coordination

Adding or removing a ticker from the watchlist has to ripple through three places in lockstep: the `watchlist` table (persistence), the active data source (so it starts/stops producing prices), and the cache (so stale entries don't linger). The watchlist API route (`PLAN.md` §8) is the single orchestrator of that ripple — `app/market/` exposes the *hooks*, not the *policy*.

### Adding a ticker

```
POST /api/watchlist {"ticker": "PYPL"}
        │
        ├─▶ normalize: "pypl" → "PYPL"            (single normalization point — PLAN.md §8)
        ├─▶ INSERT INTO watchlist ... (UNIQUE on (user_id, ticker) catches dupes → 400)
        └─▶ await source.add_ticker("PYPL")
                ├─ Simulator: GBMSimulator gets a $50–300 seed price + DEFAULT_PARAMS,
                │             Cholesky matrix is rebuilt, cache is seeded immediately
                └─ Massive:   appended to the polled-ticker list; appears on the next poll
                              (so the cache may briefly have no entry — see §16)
```

### Removing a ticker

```
DELETE /api/watchlist/PYPL
        │
        ├─▶ DELETE FROM watchlist ...    (idempotent — 200 even if it wasn't there, PLAN.md §8)
        └─▶ await source.remove_ticker("PYPL")
                ├─ Simulator: dropped from GBMSimulator, Cholesky rebuilt, cache entry removed
                └─ Massive:   dropped from the polled-ticker list, cache entry removed
```

### The asymmetry between add and remove is intentional

Adding a ticker to the simulator is **synchronous and immediate** — `GBMSimulator.add_ticker()` assigns a seed price right then, and `SimulatorDataSource.add_ticker()` writes it straight to the cache, so the very next SSE tick (≤500ms later) includes the new symbol with a real price. Adding to Massive is **eventually consistent** — the symbol joins a list that gets picked up on the *next poll cycle*, which could be up to `poll_interval` (15s by default) away. This isn't an oversight; it's the unavoidable consequence of "one batched API call per cycle" (§8.1) — there's no cheap way to fetch a single new quote out-of-band without either burning quota or adding a second, differently-shaped code path. The trade-off is accepted because it only affects the brief window after a watchlist edit, and the route can simply omit a "current price" from its response if the cache doesn't have one yet.

## 13. Anatomy of a Tick: an End-to-End Walkthrough

To see how all of the above fits together, here's exactly what happens during one simulator-driven 500ms cycle, assuming a freshly started app with the default 10-ticker watchlist and three browser tabs open:

1. **T+0ms** — `SimulatorDataSource._run_loop` wakes from `asyncio.sleep(0.5)`. It calls `self._sim.step()`.
2. **Inside `step()`** — `numpy` draws 10 independent standard normals, the Cholesky factor (built once at startup for these 10 tickers) correlates them, and the GBM formula advances each of the 10 prices by a sub-cent amount. ~0.1% of the time, one ticker also takes a 2–5% shock. The function returns `{"AAPL": 190.51, "GOOGL": 175.03, ...}`.
3. **Cache writes** — the loop calls `cache.update("AAPL", 190.51)` ... ten times. Each call briefly takes `_lock`, builds an immutable `PriceUpdate` (computing `previous_price` from whatever was there a moment ago), stores it, and increments `_version` — now at, say, `4821`.
4. **Three SSE generators wake up** — each of the three open tabs has its own `_generate_events` coroutine, each independently polling on its own `asyncio.sleep(0.5)` clock (which may be offset from the simulator's clock by up to 500ms — that's fine; nothing assumes they're synchronized).
5. **Each generator checks `price_cache.version`** — sees `4821 != last_version` (whatever it was), takes a fresh `get_all()` snapshot (a 10-entry dict, copied under the lock in microseconds), and serializes it to one `data: {...}` line covering all 10 tickers.
6. **Three independent JSON payloads go out** over three independent HTTP connections — nearly identical in content (they were all built from the same cache snapshot, give or take a few microseconds of timing skew), but generated, serialized, and transmitted completely independently. No generator knows or cares that the other two exist.
7. **In the browser**, each tab's `EventSource.onmessage` fires, parses the JSON, and for each of the 10 tickers: flashes the price cell green or red based on `direction`, appends the new point to that ticker's sparkline accumulation buffer, and — if that ticker is the currently selected one — appends to the main chart too.
8. **Meanwhter, completely independently:** if a trade for AAPL executes in this same window, the trade handler calls `cache.get_price("AAPL")` directly — a single dict lookup under the lock, returning `190.51` — and fills the order at that price. It neither knows nor needs to know that this number came from a GBM step that happened 200ms ago, or that three SSE streams are also reading it concurrently.

Nine independent actors (one simulator loop, three SSE generators, one trade handler, plus whatever the portfolio-snapshot task is doing on its own 30-second clock) touch the same cache in the same few hundred milliseconds, and **not one of them blocks on, waits for, or even knows about any of the others.** That decoupling — the entire point of §2's "push, not pull" principle — is what makes the design scale to "however many browser tabs the user opens" without a single line of additional code.

## 14. Testing Strategy

The test suite (`backend/tests/market/`, 73 tests / 84% coverage per `MARKET_DATA_SUMMARY.md`) is organized by the same boundary lines as the modules themselves — pure-math tests need no async machinery, integration tests need an event loop, and the network-facing client needs mocks. A few representative examples, chosen to illustrate *why* each layer is tested the way it is:

### Pure math — no event loop needed

`GBMSimulator` is synchronous and deterministic-shaped (even though its output is random), so it can be tested with plain `pytest`:

```python
def test_prices_never_go_negative():
    """The exp() in GBM makes negative prices mathematically impossible —
    this test exists to catch a regression that breaks that guarantee."""
    sim = GBMSimulator(tickers=["AAPL"])
    for _ in range(10_000):
        assert sim.step()["AAPL"] > 0

def test_cholesky_only_appears_with_multiple_tickers():
    sim = GBMSimulator(tickers=["AAPL"])
    assert sim._cholesky is None          # nothing to correlate with one ticker
    sim.add_ticker("GOOGL")
    assert sim._cholesky is not None       # now there's a 2x2 correlation matrix to factor
```

### Concurrency — the property that can't be eyeballed

`PriceCache`'s correctness hinges on the lock actually preventing interleaved writes — something that's easy to get subtly wrong (e.g., reading `version` outside the lock, as the original review flagged in §3.4) and impossible to verify by inspection alone. A focused concurrency test drives the point home:

```python
def test_concurrent_updates_dont_corrupt_state():
    """Hammer the cache from multiple threads simultaneously — the way the
    real app does when the Massive poller (on a worker thread) and the
    simulator loop (on the event loop) write at overlapping moments."""
    cache = PriceCache()
    def hammer(ticker, n):
        for i in range(n):
            cache.update(ticker, 100.0 + i)

    threads = [threading.Thread(target=hammer, args=(f"T{i}", 500)) for i in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert len(cache) == 8
    assert cache.version == 8 * 500          # every single update was counted — none lost to a race
```

### Integration — does the async wrapper actually drive the engine?

```python
@pytest.mark.asyncio
async def test_simulator_seeds_cache_before_first_tick():
    """Regression guard for the 'blank watchlist on page load' bug class —
    the cache must have data the instant start() returns, not 500ms later."""
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=10.0)  # long interval
    await source.start(["AAPL", "GOOGL"])

    assert cache.get("AAPL") is not None and cache.get("GOOGL") is not None
    await source.stop()
```

### Network boundary — mock the transport, test the logic

`MassiveDataSource` is the one module where "real" testing would mean live API calls (slow, flaky, quota-burning). Instead, `_fetch_snapshots` — the one method that actually talks to the network — is mocked, and everything *around* it (parsing, error isolation, cache writes) is tested against the mock's output:

```python
@pytest.mark.asyncio
async def test_one_bad_snapshot_does_not_block_the_rest(monkeypatch):
    """A delisted ticker with no last_trade shouldn't blank out nine good quotes."""
    cache = PriceCache()
    source = MassiveDataSource(api_key="x", price_cache=cache, poll_interval=999)
    source._tickers = ["AAPL", "ZOMBIE"]

    good = _make_snapshot("AAPL", 190.50, 1751875200000)
    bad = MagicMock(ticker="ZOMBIE", last_trade=None)        # triggers AttributeError on .price

    monkeypatch.setattr(source, "_fetch_snapshots", lambda: [good, bad])
    await source._poll_once()

    assert cache.get_price("AAPL") == 190.50    # the good one made it through
    assert cache.get_price("ZOMBIE") is None     # the bad one was logged and skipped, not crashed on
```

This shape — "mock the I/O boundary, assert on the resilience behavior" — is what lets the test suite exercise every error path from §8.4 (bad key, rate limit, malformed payload, total failure) without ever making a real HTTP request.

## 15. Configuration & Tuning Reference

| Knob | Lives in | Default | Effect of turning it up |
|---|---|---|---|
| `MASSIVE_API_KEY` | `.env` | unset | Set + non-empty → real Massive data; unset/empty → simulator |
| `update_interval` | `SimulatorDataSource(...)` | `0.5` s | Smoother-looking ticks but more CPU spent on `numpy` draws and cache writes |
| `event_probability` | `GBMSimulator(...)` | `0.001` | More frequent dramatic shocks; too high and the market stops looking realistic |
| `poll_interval` | `MassiveDataSource(...)` | `15.0` s | Fresher real-world quotes, at the cost of API quota — free tier caps at 5 req/min ⇒ minimum safe interval ≈ 12s |
| SSE push interval | `_generate_events(..., interval=...)` | `0.5` s | Tighter coupling to the simulator's own cadence; going much higher starts to feel laggy to the user |
| SSE retry directive | `"retry: 1000\n\n"` | `1000` ms | How long the browser waits before attempting to reconnect after a drop |
| `dt` | `GBMSimulator(...)` | `~8.48e-8` (derived from 252 trading days × 6.5h) | Larger `dt` ⇒ bigger per-tick swings; recalculate from the trading-calendar formula in §7.1 rather than guessing |

All of these are constructor/function parameters with sensible defaults — none require code changes to tune for a different demo cadence or a paid Massive tier with tighter polling.

## 16. Troubleshooting Runbook

Quick diagnoses for the failure modes most likely to show up during development or grading:

| Symptom | Likely cause | Where to look |
|---|---|---|
| Watchlist shows tickers but no prices, forever | `MASSIVE_API_KEY` is set but invalid (401) | Backend logs for `"Massive poll failed"`; the SSE connection itself will show "connected" — the *stream* is healthy, the *source* isn't (§8.4) |
| A newly-added ticker shows no price for ~15 seconds | Expected Massive behavior — the symbol joins the polled list but waits for the next cycle (§12) | Not a bug; the simulator path seeds immediately and has no such gap |
| `400 Price not yet available for X` on a trade | Cache miss — ticker was just added and the source hasn't produced a price for it yet | `PriceCache.get_price()` returned `None`; this is the documented, correct response (§10) — wait a moment and retry |
| Dashboard freezes mid-session, no new ticks | Background task died — but it shouldn't, because both `_run_loop` and `_poll_once` wrap their bodies in broad `except` blocks | If this happens, it's a bug in the *catch* logic itself, not an expected failure mode; check logs for an uncaught exception type that slipped past the `except Exception` |
| `uv sync` / Docker build fails with "Unable to determine which files to ship inside the wheel" | Missing hatchling package config (a real issue caught in code review — see `MARKET_DATA_REVIEW.md` §3.1) | `pyproject.toml` needs `[tool.hatch.build.targets.wheel] packages = ["app"]` |
| Tests for `MassiveDataSource` fail locally | The `massive` package isn't installed, or `RESTClient` is being patched at a name that doesn't exist | Confirm `massive` is in the resolved environment (`uv sync --extra dev`); patch `_fetch_snapshots` directly rather than `RESTClient` to stay independent of import strategy |

## 17. Extension Points

The strategy-pattern boundary (§4) is also the natural seam for anything that comes after this MVP:

- **A third data source** (a different vendor, a websocket-based feed, a CSV replay for offline demos) only needs to implement `MarketDataSource`'s five methods and get wired into `create_market_data_source`'s branch logic — nothing in `cache.py`, `stream.py`, or any consumer changes.
- **Historical bars / aggregates.** `PLAN.md`'s frontend spec builds charts entirely from SSE-accumulated, since-page-load data — but if a "load historical context on selection" feature were ever added, the natural home is a sibling method on the same data-source ABC (e.g., `async def get_history(ticker, range) -> list[Bar]`), kept separate from the live-tick `PriceUpdate` path so the cache's "latest snapshot only" simplicity (§6, "Potential Future Considerations" in the original review) is preserved.
- **Per-connection SSE tuning.** Because `_generate_events` takes `interval` as a parameter, a future "fast mode" / "slow mode" toggle in the UI could thread a query parameter through to the generator without touching the cache or either data source — the layers below the SSE endpoint are already cadence-agnostic by design.
- **Read-write lock if contention ever appears.** §6 already notes that `threading.Lock` is a full mutex; if this project ever grew to hundreds of tickers and dozens of concurrent SSE readers, swapping in a reader-writer lock would be a localized change entirely inside `cache.py` — every caller already goes through `get`/`get_all`/`update`, so the lock type is an implementation detail none of them can observe.
