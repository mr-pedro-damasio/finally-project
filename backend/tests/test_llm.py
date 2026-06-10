"""Unit tests for the LLM integration module."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.llm import ChatResponse, TradeAction, WatchlistAction, chat, _format_portfolio_context


SAMPLE_PORTFOLIO = {
    "cash": 9500.0,
    "total_value": 12000.0,
    "positions": [
        {
            "ticker": "AAPL",
            "quantity": 10.0,
            "avg_cost": 185.0,
            "current_price": 190.0,
            "unrealized_pnl": 50.0,
            "pnl_percent": 2.70,
        }
    ],
    "watchlist": [
        {"ticker": "AAPL", "price": 190.0},
        {"ticker": "GOOGL", "price": 175.0},
    ],
}

SAMPLE_HISTORY = [
    {"role": "user", "content": "What's my portfolio?"},
    {"role": "assistant", "content": "You have 10 shares of AAPL."},
]


@pytest.mark.asyncio
async def test_mock_mode_returns_deterministic_response(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    result = await chat("buy AAPL", SAMPLE_HISTORY, SAMPLE_PORTFOLIO)
    assert isinstance(result, ChatResponse)
    assert result.message == "Mock response: your portfolio looks balanced."
    assert result.trades == []
    assert result.watchlist_changes == []


@pytest.mark.asyncio
async def test_mock_mode_no_llm_call(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    with patch("app.llm.completion") as mock_completion:
        await chat("hello", [], SAMPLE_PORTFOLIO)
        mock_completion.assert_not_called()


@pytest.mark.asyncio
async def test_successful_llm_call_parses_response(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    expected = ChatResponse(
        message="Buying 10 AAPL for you.",
        trades=[TradeAction(ticker="AAPL", side="buy", quantity=10.0)],
        watchlist_changes=[],
    )
    mock_response = MagicMock()
    mock_response.choices[0].message.content = expected.model_dump_json()

    with patch("app.llm.completion", return_value=mock_response) as mock_completion:
        result = await chat("Buy 10 AAPL", SAMPLE_HISTORY, SAMPLE_PORTFOLIO)

    assert result.message == "Buying 10 AAPL for you."
    assert len(result.trades) == 1
    assert result.trades[0].ticker == "AAPL"
    assert result.trades[0].side == "buy"
    assert result.trades[0].quantity == 10.0
    assert result.watchlist_changes == []
    mock_completion.assert_called_once()


@pytest.mark.asyncio
async def test_llm_exception_returns_fallback(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    with patch("app.llm.completion", side_effect=RuntimeError("API error")):
        result = await chat("buy AAPL", [], SAMPLE_PORTFOLIO)

    assert isinstance(result, ChatResponse)
    assert result.message == "Sorry, I had trouble processing that — please try again."
    assert result.trades == []
    assert result.watchlist_changes == []


@pytest.mark.asyncio
async def test_malformed_json_returns_fallback(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "not valid json {{"

    with patch("app.llm.completion", return_value=mock_response):
        result = await chat("hello", [], SAMPLE_PORTFOLIO)

    assert result.message == "Sorry, I had trouble processing that — please try again."
    assert result.trades == []
    assert result.watchlist_changes == []


@pytest.mark.asyncio
async def test_history_and_portfolio_context_in_messages(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    mock_response = MagicMock()
    mock_response.choices[0].message.content = ChatResponse(
        message="Noted.", trades=[], watchlist_changes=[]
    ).model_dump_json()

    captured_messages = []

    def fake_completion(**kwargs):
        captured_messages.extend(kwargs["messages"])
        return mock_response

    with patch("app.llm.completion", side_effect=fake_completion):
        await chat("What should I do?", SAMPLE_HISTORY, SAMPLE_PORTFOLIO)

    # system message first
    assert captured_messages[0]["role"] == "system"
    assert "FinAlly" in captured_messages[0]["content"]

    # history messages included
    assert captured_messages[1]["role"] == "user"
    assert captured_messages[1]["content"] == "What's my portfolio?"
    assert captured_messages[2]["role"] == "assistant"

    # last message contains user message and portfolio context
    last = captured_messages[-1]
    assert last["role"] == "user"
    assert "What should I do?" in last["content"]
    assert "Portfolio Context:" in last["content"]
    assert "Cash: $9,500.00" in last["content"]
    assert "AAPL" in last["content"]


def test_format_portfolio_context_with_positions():
    result = _format_portfolio_context(SAMPLE_PORTFOLIO)
    assert "Cash: $9,500.00" in result
    assert "Total Value: $12,000.00" in result
    assert "AAPL: 10" in result
    assert "Watchlist: AAPL, GOOGL" in result


def test_format_portfolio_context_empty():
    result = _format_portfolio_context({"cash": 10000.0, "total_value": 10000.0})
    assert "Cash: $10,000.00" in result
    assert "Positions: None" in result


@pytest.mark.asyncio
async def test_watchlist_changes_parsed(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    expected = ChatResponse(
        message="Added PYPL to your watchlist.",
        trades=[],
        watchlist_changes=[WatchlistAction(ticker="PYPL", action="add")],
    )
    mock_response = MagicMock()
    mock_response.choices[0].message.content = expected.model_dump_json()

    with patch("app.llm.completion", return_value=mock_response):
        result = await chat("Add PYPL to watchlist", [], SAMPLE_PORTFOLIO)

    assert len(result.watchlist_changes) == 1
    assert result.watchlist_changes[0].ticker == "PYPL"
    assert result.watchlist_changes[0].action == "add"
