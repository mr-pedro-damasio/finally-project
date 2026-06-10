"""Route tests using FastAPI TestClient with mocked database and market modules."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.market import PriceCache, create_stream_router
from app.llm import ChatResponse, TradeAction, WatchlistAction
import app.database as real_db
import app.portfolio as portfolio_mod
import app.chat_service as chat_service_mod


# --- Shared price cache ---
_price_cache = PriceCache()
_price_cache.update("AAPL", 190.50)

_mock_market_source = MagicMock()
_mock_market_source.start = AsyncMock()
_mock_market_source.stop = AsyncMock()
_mock_market_source.add_ticker = AsyncMock()
_mock_market_source.remove_ticker = AsyncMock()


def _make_db_patches():
    """Return a dict of patch targets -> AsyncMock/return_value pairs."""
    return {
        "app.database.get_watchlist": AsyncMock(return_value=[{"ticker": "AAPL", "added_at": "2024-01-01T00:00:00"}]),
        "app.database.add_to_watchlist": AsyncMock(),
        "app.database.remove_from_watchlist": AsyncMock(),
        "app.database.get_positions": AsyncMock(return_value=[]),
        "app.database.get_cash_balance": AsyncMock(return_value=10000.0),
        "app.database.set_cash_balance": AsyncMock(),
        "app.database.upsert_position": AsyncMock(),
        "app.database.delete_position": AsyncMock(),
        "app.database.record_trade": AsyncMock(),
        "app.database.record_portfolio_snapshot": AsyncMock(),
        "app.database.get_portfolio_history": AsyncMock(return_value=[{"total_value": 10000.0, "recorded_at": "2024-01-01T00:00:00"}]),
        "app.database.save_chat_message": AsyncMock(),
        "app.database.get_chat_history": AsyncMock(return_value=[]),
    }


@pytest.fixture
def db_mocks():
    """Patch all database functions for the duration of a test."""
    patches = {}
    mocks = {}
    db_patch_spec = _make_db_patches()
    for target, mock_obj in db_patch_spec.items():
        p = patch(target, mock_obj)
        mocks[target.split(".")[-1]] = p.start()
        patches[target] = p

    yield mocks

    for p in patches.values():
        p.stop()


@pytest.fixture
def llm_mock():
    """Patch app.llm.chat for the duration of a test."""
    mock = AsyncMock(return_value=ChatResponse(
        message="Mock response: your portfolio looks balanced.",
        trades=[],
        watchlist_changes=[],
    ))
    with patch("app.llm.chat", mock):
        with patch("app.chat_service.llm_chat", mock):
            yield mock


@pytest.fixture
def client(db_mocks, llm_mock):
    """Return a TestClient with mocked state."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routes.health import router as health_router
    from app.routes.watchlist import router as watchlist_router
    from app.routes.portfolio import router as portfolio_router
    from app.routes.chat import router as chat_router

    test_app = FastAPI()
    test_app.state.price_cache = _price_cache
    test_app.state.market_source = _mock_market_source

    test_app.include_router(create_stream_router(_price_cache))
    test_app.include_router(health_router)
    test_app.include_router(watchlist_router)
    test_app.include_router(portfolio_router)
    test_app.include_router(chat_router)

    with TestClient(test_app) as c:
        c.db = db_mocks
        c.llm = llm_mock
        yield c


# --- Health ---

def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# --- Watchlist ---

def test_get_watchlist(client):
    resp = client.get("/api/watchlist")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["ticker"] == "AAPL"
    assert data[0]["price"] == 190.50


def test_post_watchlist_success(client):
    client.db["add_to_watchlist"].reset_mock()
    client.db["get_watchlist"].return_value = [
        {"ticker": "PYPL", "added_at": "2024-06-01T00:00:00"}
    ]
    _mock_market_source.add_ticker.reset_mock()
    resp = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "PYPL"
    client.db["add_to_watchlist"].assert_awaited_once_with("default", "PYPL")
    _mock_market_source.add_ticker.assert_awaited_with("PYPL")


def test_post_watchlist_duplicate(client):
    client.db["add_to_watchlist"].side_effect = ValueError("Ticker already in watchlist")
    resp = client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Ticker already in watchlist"
    client.db["add_to_watchlist"].side_effect = None


def test_delete_watchlist(client):
    client.db["remove_from_watchlist"].reset_mock()
    resp = client.delete("/api/watchlist/AAPL")
    assert resp.status_code == 200
    assert resp.json()["removed"] is True
    client.db["remove_from_watchlist"].assert_awaited_once_with("default", "AAPL")


# --- Portfolio ---

def test_get_portfolio(client):
    client.db["get_positions"].return_value = []
    client.db["get_cash_balance"].return_value = 10000.0
    resp = client.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cash_balance"] == 10000.0
    assert data["total_value"] == 10000.0
    assert data["positions"] == []


def test_get_portfolio_with_position(client):
    client.db["get_positions"].return_value = [
        {"ticker": "AAPL", "quantity": 10.0, "avg_cost": 185.0, "updated_at": "2024-01-01"}
    ]
    client.db["get_cash_balance"].return_value = 8150.0
    resp = client.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["positions"]) == 1
    pos = data["positions"][0]
    assert pos["ticker"] == "AAPL"
    assert pos["quantity"] == 10.0
    assert pos["current_price"] == 190.50
    assert pos["unrealized_pnl"] == round((190.50 - 185.0) * 10, 2)


def test_trade_buy_success(client):
    client.db["get_positions"].return_value = []
    client.db["get_cash_balance"].return_value = 10000.0
    client.db["record_trade"].reset_mock()
    resp = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10, "side": "buy"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["ticker"] == "AAPL"
    assert data["side"] == "buy"
    assert data["quantity"] == 10
    assert data["price"] == 190.50


def test_trade_buy_insufficient_cash(client):
    client.db["get_positions"].return_value = []
    client.db["get_cash_balance"].return_value = 100.0
    resp = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10, "side": "buy"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Insufficient cash"


def test_trade_sell_no_position(client):
    client.db["get_positions"].return_value = []
    resp = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5, "side": "sell"})
    assert resp.status_code == 400
    assert "No position" in resp.json()["error"]


def test_trade_ticker_not_in_cache(client):
    resp = client.post("/api/portfolio/trade", json={"ticker": "ZZZZ", "quantity": 1, "side": "buy"})
    assert resp.status_code == 400
    assert "not found in price cache" in resp.json()["error"]


def test_get_portfolio_history(client):
    resp = client.get("/api/portfolio/history")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["total_value"] == 10000.0


# --- Chat ---

def test_get_chat_history(client):
    client.db["get_chat_history"].return_value = [
        {"role": "user", "content": "hello", "executed_actions": None, "created_at": "2024-01-01"}
    ]
    resp = client.get("/api/chat/history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["role"] == "user"


def test_post_chat(client):
    client.db["get_chat_history"].return_value = []
    client.db["get_positions"].return_value = []
    client.db["get_cash_balance"].return_value = 10000.0
    client.db["get_watchlist"].return_value = [{"ticker": "AAPL", "added_at": "2024-01-01"}]
    client.llm.return_value = ChatResponse(
        message="Mock response: your portfolio looks balanced.",
        trades=[],
        watchlist_changes=[],
    )
    resp = client.post("/api/chat", json={"message": "How is my portfolio?"})
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert "trades" in data
    assert "watchlist_changes" in data
    assert "trade_results" in data


def test_post_chat_with_trade(client):
    client.db["get_chat_history"].return_value = []
    client.db["get_positions"].return_value = []
    client.db["get_cash_balance"].return_value = 10000.0
    client.db["get_watchlist"].return_value = [{"ticker": "AAPL", "added_at": "2024-01-01"}]
    client.llm.return_value = ChatResponse(
        message="Bought 5 shares of AAPL.",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=5)],
        watchlist_changes=[],
    )
    resp = client.post("/api/chat", json={"message": "Buy 5 AAPL"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["trades"]) == 1
    assert len(data["trade_results"]) == 1
    assert data["trade_results"][0]["success"] is True
