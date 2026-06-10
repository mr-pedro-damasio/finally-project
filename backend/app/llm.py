"""LLM integration module for FinAlly chat."""

import logging
import os

from dotenv import load_dotenv
from litellm import completion
from pydantic import BaseModel

load_dotenv("/workspaces/finally-project/.env")

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant for a simulated portfolio.
You analyze portfolio composition, P&L, and risk concentration.
You suggest and execute trades when the user asks.
You manage the watchlist proactively.
Be concise, data-driven, and professional.
CRITICAL: Never guess at an unspecified trade size. If the user's message lacks a concrete quantity or dollar amount, ask a clarifying question in "message" and emit an empty "trades" array.
Always respond with valid JSON matching the schema: {"message": "...", "trades": [{"ticker": "...", "side": "buy|sell", "quantity": number}], "watchlist_changes": [{"ticker": "...", "action": "add|remove"}]}"""


class TradeAction(BaseModel):
    ticker: str
    side: str  # "buy" | "sell"
    quantity: float


class WatchlistAction(BaseModel):
    ticker: str
    action: str  # "add" | "remove"


class ChatResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistAction] = []


def _format_portfolio_context(portfolio_context: dict) -> str:
    cash = portfolio_context.get("cash", 0)
    total_value = portfolio_context.get("total_value", 0)
    positions = portfolio_context.get("positions", [])
    watchlist = portfolio_context.get("watchlist", [])

    lines = [
        "Portfolio Context:",
        f"Cash: ${cash:,.2f} | Total Value: ${total_value:,.2f}",
    ]

    if positions:
        lines.append("Positions:")
        for p in positions:
            ticker = p.get("ticker", "")
            qty = p.get("quantity", 0)
            avg_cost = p.get("avg_cost", 0)
            current_price = p.get("current_price", 0)
            pnl = p.get("unrealized_pnl", 0)
            pnl_pct = p.get("pnl_percent", 0)
            sign = "+" if pnl >= 0 else ""
            lines.append(
                f"  {ticker}: {qty} shares @ ${avg_cost:.2f} avg cost, "
                f"current ${current_price:.2f}, P&L: {sign}${pnl:.2f} ({sign}{pnl_pct:.2f}%)"
            )
    else:
        lines.append("Positions: None")

    if watchlist:
        tickers = ", ".join(w.get("ticker", "") for w in watchlist)
        lines.append(f"Watchlist: {tickers}")

    return "\n".join(lines)


async def chat(
    user_message: str,
    history: list[dict],
    portfolio_context: dict,
) -> ChatResponse:
    if os.environ.get("LLM_MOCK", "").lower() == "true":
        return ChatResponse(
            message="Mock response: your portfolio looks balanced.",
            trades=[],
            watchlist_changes=[],
        )

    try:
        context_str = _format_portfolio_context(portfolio_context)
        enriched_user_message = f"{context_str}\n\nUser: {user_message}"

        messages = (
            [{"role": "system", "content": SYSTEM_PROMPT}]
            + history
            + [{"role": "user", "content": enriched_user_message}]
        )

        response = completion(
            model=MODEL,
            messages=messages,
            response_format=ChatResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        raw = response.choices[0].message.content
        return ChatResponse.model_validate_json(raw)

    except Exception:
        logger.exception("LLM call failed")
        return ChatResponse(
            message="Sorry, I had trouble processing that — please try again.",
            trades=[],
            watchlist_changes=[],
        )
