import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite

DB_PATH = os.environ.get("DB_PATH", "db/finally.db")
SCHEMA_PATH = Path(__file__).parent.parent / "schema" / "schema.sql"

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]

# Shared connection used when DB_PATH is ":memory:" — prevents each call from opening
# a separate in-memory database that is invisible to others.
_memory_db: aiosqlite.Connection | None = None


def _get_db_path() -> str:
    return os.environ.get("DB_PATH", "db/finally.db")


async def _setup_pragmas(db: aiosqlite.Connection) -> None:
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=5000")


def _get_db():
    """Return an async context manager that yields a WAL-mode connection."""
    path = _get_db_path()
    if path == ":memory:":
        return _MemoryDbProxy()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    return _FileDbContext(path)


class _FileDbContext:
    """Opens a file-based aiosqlite connection, sets PRAGMAs, closes on exit."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._db: aiosqlite.Connection | None = None

    def __await__(self):
        # Support `async with await _get_db()` pattern — just return self
        return self._noop().__await__()

    async def _noop(self):
        return self

    async def __aenter__(self) -> aiosqlite.Connection:
        self._db = await aiosqlite.connect(self._path)
        self._db.row_factory = aiosqlite.Row
        await _setup_pragmas(self._db)
        return self._db

    async def __aexit__(self, *args: object) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None


class _MemoryDbProxy:
    """Uses the module-level shared in-memory connection; never closes it."""

    def __await__(self):
        return self._noop().__await__()

    async def _noop(self):
        return self

    async def __aenter__(self) -> aiosqlite.Connection:
        global _memory_db
        if _memory_db is None:
            _memory_db = await aiosqlite.connect(":memory:")
            _memory_db.row_factory = aiosqlite.Row
            await _setup_pragmas(_memory_db)
        return _memory_db

    async def __aexit__(self, *args: object) -> None:
        pass  # Do not close the shared in-memory connection


async def reset_memory_db() -> None:
    """Drop and recreate the shared in-memory connection (test helper)."""
    global _memory_db
    if _memory_db is not None:
        await _memory_db.close()
        _memory_db = None


async def init_db() -> None:
    """Create tables (reads schema.sql), set WAL + busy_timeout, seed defaults."""
    schema = SCHEMA_PATH.read_text()
    async with await _get_db() as db:
        await db.executescript(schema)
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )
        for ticker in DEFAULT_TICKERS:
            await db.execute(
                "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, "default", ticker, now),
            )
        await db.commit()


async def get_cash_balance(user_id: str = "default") -> float:
    async with await _get_db() as db:
        async with db.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return float(row["cash_balance"]) if row else 0.0


async def set_cash_balance(user_id: str, new_balance: float) -> None:
    rounded = round(new_balance, 2)
    async with await _get_db() as db:
        await db.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
            (rounded, user_id),
        )
        await db.commit()


async def get_watchlist(user_id: str = "default") -> list[dict]:
    async with await _get_db() as db:
        async with db.execute(
            "SELECT ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"ticker": row["ticker"], "added_at": row["added_at"]} for row in rows]


async def add_to_watchlist(user_id: str, ticker: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with await _get_db() as db:
        try:
            await db.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, user_id, ticker, now),
            )
            await db.commit()
        except aiosqlite.IntegrityError:
            raise ValueError("Ticker already in watchlist")


async def remove_from_watchlist(user_id: str, ticker: str) -> None:
    async with await _get_db() as db:
        await db.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (user_id, ticker),
        )
        await db.commit()


async def get_positions(user_id: str = "default") -> list[dict]:
    async with await _get_db() as db:
        async with db.execute(
            "SELECT ticker, quantity, avg_cost, updated_at FROM positions WHERE user_id = ?",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "ticker": row["ticker"],
                    "quantity": float(row["quantity"]),
                    "avg_cost": float(row["avg_cost"]),
                    "updated_at": row["updated_at"],
                }
                for row in rows
            ]


async def upsert_position(user_id: str, ticker: str, quantity: float, avg_cost: float) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with await _get_db() as db:
        await db.execute(
            """
            INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, ticker) DO UPDATE SET
                quantity = excluded.quantity,
                avg_cost = excluded.avg_cost,
                updated_at = excluded.updated_at
            """,
            (uuid.uuid4().hex, user_id, ticker, quantity, avg_cost, now),
        )
        await db.commit()


async def delete_position(user_id: str, ticker: str) -> None:
    async with await _get_db() as db:
        await db.execute(
            "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
            (user_id, ticker),
        )
        await db.commit()


async def record_trade(
    user_id: str, ticker: str, side: str, quantity: float, price: float
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with await _get_db() as db:
        await db.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, user_id, ticker, side, quantity, price, now),
        )
        await db.commit()


async def record_portfolio_snapshot(user_id: str, total_value: float) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with await _get_db() as db:
        await db.execute(
            "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
            (uuid.uuid4().hex, user_id, total_value, now),
        )
        await db.commit()


async def get_portfolio_history(user_id: str = "default", limit: int = 500) -> list[dict]:
    async with await _get_db() as db:
        async with db.execute(
            """
            SELECT total_value, recorded_at FROM (
                SELECT total_value, recorded_at FROM portfolio_snapshots
                WHERE user_id = ?
                ORDER BY recorded_at DESC
                LIMIT ?
            ) ORDER BY recorded_at ASC
            """,
            (user_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {"total_value": float(row["total_value"]), "recorded_at": row["recorded_at"]}
                for row in rows
            ]


async def save_chat_message(
    user_id: str,
    role: str,
    content: str,
    executed_actions: dict | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    actions_json = json.dumps(executed_actions) if executed_actions is not None else None
    async with await _get_db() as db:
        await db.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, executed_actions, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, user_id, role, content, actions_json, now),
        )
        await db.commit()


async def get_chat_history(user_id: str = "default", limit: int = 20) -> list[dict]:
    async with await _get_db() as db:
        async with db.execute(
            """
            SELECT role, content, executed_actions, created_at FROM (
                SELECT role, content, executed_actions, created_at FROM chat_messages
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            ) ORDER BY created_at ASC
            """,
            (user_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                actions = None
                if row["executed_actions"] is not None:
                    actions = json.loads(row["executed_actions"])
                result.append(
                    {
                        "role": row["role"],
                        "content": row["content"],
                        "executed_actions": actions,
                        "created_at": row["created_at"],
                    }
                )
            return result
