"""Tests for the database module using in-memory SQLite."""

import os

import pytest

os.environ["DB_PATH"] = ":memory:"

import app.database as db_module
from app.database import (
    add_to_watchlist,
    delete_position,
    get_cash_balance,
    get_chat_history,
    get_portfolio_history,
    get_positions,
    get_watchlist,
    init_db,
    record_portfolio_snapshot,
    record_trade,
    remove_from_watchlist,
    reset_memory_db,
    save_chat_message,
    set_cash_balance,
    upsert_position,
)


@pytest.fixture(autouse=True)
async def fresh_db():
    """Reset the in-memory DB before each test."""
    await reset_memory_db()
    await init_db()
    yield


class TestInitDb:
    async def test_creates_tables_and_seeds_user(self):
        balance = await get_cash_balance("default")
        assert balance == 10000.0

    async def test_seeds_10_default_tickers(self):
        watchlist = await get_watchlist("default")
        assert len(watchlist) == 10
        tickers = {row["ticker"] for row in watchlist}
        assert tickers == {"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"}

    async def test_init_db_idempotent(self):
        # Calling init_db again should not duplicate seed data
        await init_db()
        watchlist = await get_watchlist("default")
        assert len(watchlist) == 10
        balance = await get_cash_balance("default")
        assert balance == 10000.0


class TestCashBalance:
    async def test_get_cash_balance_default(self):
        assert await get_cash_balance() == 10000.0

    async def test_set_cash_balance_persists(self):
        await set_cash_balance("default", 5000.0)
        assert await get_cash_balance("default") == 5000.0

    async def test_set_cash_balance_rounds_to_2_decimals(self):
        await set_cash_balance("default", 9999.999999999998)
        assert await get_cash_balance("default") == 10000.0

    async def test_set_cash_balance_rounds_down(self):
        await set_cash_balance("default", 1234.567)
        assert await get_cash_balance("default") == 1234.57

    async def test_get_cash_balance_nonexistent_user(self):
        assert await get_cash_balance("nobody") == 0.0


class TestWatchlist:
    async def test_get_watchlist_returns_10_tickers(self):
        watchlist = await get_watchlist()
        assert len(watchlist) == 10

    async def test_get_watchlist_has_ticker_and_added_at(self):
        watchlist = await get_watchlist()
        for entry in watchlist:
            assert "ticker" in entry
            assert "added_at" in entry

    async def test_add_to_watchlist(self):
        await add_to_watchlist("default", "PYPL")
        watchlist = await get_watchlist("default")
        tickers = {row["ticker"] for row in watchlist}
        assert "PYPL" in tickers

    async def test_add_to_watchlist_duplicate_raises_value_error(self):
        with pytest.raises(ValueError, match="Ticker already in watchlist"):
            await add_to_watchlist("default", "AAPL")

    async def test_remove_from_watchlist(self):
        await remove_from_watchlist("default", "AAPL")
        watchlist = await get_watchlist("default")
        tickers = {row["ticker"] for row in watchlist}
        assert "AAPL" not in tickers
        assert len(watchlist) == 9

    async def test_remove_from_watchlist_idempotent(self):
        await remove_from_watchlist("default", "AAPL")
        await remove_from_watchlist("default", "AAPL")  # Should not raise
        watchlist = await get_watchlist("default")
        assert len(watchlist) == 9

    async def test_remove_nonexistent_ticker_idempotent(self):
        await remove_from_watchlist("default", "ZZZZ")  # Should not raise
        watchlist = await get_watchlist("default")
        assert len(watchlist) == 10

    async def test_watchlist_ordered_by_added_at(self):
        watchlist = await get_watchlist()
        added_ats = [row["added_at"] for row in watchlist]
        assert added_ats == sorted(added_ats)


class TestPositions:
    async def test_get_positions_empty_initially(self):
        positions = await get_positions()
        assert positions == []

    async def test_upsert_position_creates(self):
        await upsert_position("default", "AAPL", 10.0, 185.0)
        positions = await get_positions("default")
        assert len(positions) == 1
        pos = positions[0]
        assert pos["ticker"] == "AAPL"
        assert pos["quantity"] == 10.0
        assert pos["avg_cost"] == 185.0
        assert "updated_at" in pos

    async def test_upsert_position_updates(self):
        await upsert_position("default", "AAPL", 10.0, 185.0)
        await upsert_position("default", "AAPL", 20.0, 190.0)
        positions = await get_positions("default")
        assert len(positions) == 1
        assert positions[0]["quantity"] == 20.0
        assert positions[0]["avg_cost"] == 190.0

    async def test_upsert_multiple_positions(self):
        await upsert_position("default", "AAPL", 10.0, 185.0)
        await upsert_position("default", "GOOGL", 5.0, 175.0)
        positions = await get_positions("default")
        assert len(positions) == 2

    async def test_delete_position(self):
        await upsert_position("default", "AAPL", 10.0, 185.0)
        await delete_position("default", "AAPL")
        positions = await get_positions("default")
        assert positions == []

    async def test_delete_nonexistent_position_no_error(self):
        await delete_position("default", "ZZZZ")  # Should not raise


class TestTrades:
    async def test_record_trade_buy(self):
        await record_trade("default", "AAPL", "buy", 10.0, 190.50)

    async def test_record_trade_sell(self):
        await record_trade("default", "AAPL", "sell", 5.0, 192.00)

    async def test_record_multiple_trades(self):
        await record_trade("default", "AAPL", "buy", 10.0, 190.50)
        await record_trade("default", "AAPL", "sell", 5.0, 192.00)
        await record_trade("default", "GOOGL", "buy", 3.0, 175.00)


class TestPortfolioHistory:
    async def test_record_and_get_portfolio_snapshot(self):
        await record_portfolio_snapshot("default", 10000.0)
        history = await get_portfolio_history("default")
        assert len(history) == 1
        assert history[0]["total_value"] == 10000.0
        assert "recorded_at" in history[0]

    async def test_portfolio_history_oldest_first(self):
        await record_portfolio_snapshot("default", 10000.0)
        await record_portfolio_snapshot("default", 10500.0)
        await record_portfolio_snapshot("default", 11000.0)
        history = await get_portfolio_history("default")
        assert len(history) == 3
        values = [h["total_value"] for h in history]
        assert values == sorted(values)

    async def test_portfolio_history_respects_limit(self):
        for i in range(10):
            await record_portfolio_snapshot("default", 10000.0 + i)
        history = await get_portfolio_history("default", limit=5)
        assert len(history) == 5

    async def test_portfolio_history_limit_returns_most_recent(self):
        for i in range(10):
            await record_portfolio_snapshot("default", float(i))
        history = await get_portfolio_history("default", limit=3)
        # Should return the 3 most recent, ordered oldest-first
        values = [h["total_value"] for h in history]
        assert values == [7.0, 8.0, 9.0]

    async def test_portfolio_history_empty(self):
        history = await get_portfolio_history("default")
        assert history == []


class TestChatHistory:
    async def test_save_and_get_chat_message(self):
        await save_chat_message("default", "user", "Hello!")
        history = await get_chat_history("default")
        assert len(history) == 1
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello!"
        assert history[0]["executed_actions"] is None

    async def test_save_message_with_executed_actions(self):
        actions = {"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}], "watchlist_changes": [], "trade_results": []}
        await save_chat_message("default", "assistant", "Done!", executed_actions=actions)
        history = await get_chat_history("default")
        assert len(history) == 1
        assert history[0]["executed_actions"] == actions

    async def test_chat_history_oldest_first(self):
        await save_chat_message("default", "user", "first")
        await save_chat_message("default", "assistant", "second")
        await save_chat_message("default", "user", "third")
        history = await get_chat_history("default")
        assert [h["content"] for h in history] == ["first", "second", "third"]

    async def test_chat_history_respects_limit(self):
        for i in range(25):
            await save_chat_message("default", "user", f"msg {i}")
        history = await get_chat_history("default", limit=20)
        assert len(history) == 20

    async def test_chat_history_returns_most_recent(self):
        for i in range(25):
            await save_chat_message("default", "user", f"msg {i}")
        history = await get_chat_history("default", limit=5)
        contents = [h["content"] for h in history]
        assert contents == [f"msg {i}" for i in range(20, 25)]

    async def test_chat_history_none_executed_actions(self):
        await save_chat_message("default", "user", "hi", executed_actions=None)
        history = await get_chat_history("default")
        assert history[0]["executed_actions"] is None

    async def test_chat_history_empty(self):
        history = await get_chat_history("default")
        assert history == []
