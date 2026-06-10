from app.llm import chat as llm_chat, ChatResponse
from app.portfolio import execute_trade, get_portfolio
import app.database as db


async def handle_chat(
    user_message: str,
    price_cache,
    user_id: str = "default",
    market_source=None,
) -> dict:
    await db.save_chat_message(user_id, "user", user_message)

    history_rows = await db.get_chat_history(user_id, limit=20)
    history = [{"role": r["role"], "content": r["content"]} for r in history_rows]

    portfolio = await get_portfolio(price_cache, user_id)
    watchlist_rows = await db.get_watchlist(user_id)
    watchlist_prices = []
    for row in watchlist_rows:
        update = price_cache.get(row["ticker"])
        watchlist_prices.append(
            {
                "ticker": row["ticker"],
                "price": update.price if update else None,
            }
        )

    portfolio_context = {
        "cash": portfolio["cash_balance"],
        "total_value": portfolio["total_value"],
        "positions": portfolio["positions"],
        "watchlist": watchlist_prices,
    }

    llm_response: ChatResponse = await llm_chat(user_message, history, portfolio_context)

    trade_results = []
    for trade in llm_response.trades[:10]:
        try:
            result = await execute_trade(
                trade.ticker, trade.side, trade.quantity, price_cache, user_id
            )
            trade_results.append({**result, "success": True})
        except ValueError as e:
            trade_results.append(
                {
                    "ticker": trade.ticker,
                    "side": trade.side,
                    "quantity": trade.quantity,
                    "success": False,
                    "error": str(e),
                }
            )

    for trade in llm_response.trades[10:]:
        trade_results.append(
            {
                "ticker": trade.ticker,
                "side": trade.side,
                "quantity": trade.quantity,
                "success": False,
                "error": "Trade cap exceeded (max 10 per message)",
            }
        )

    for wc in llm_response.watchlist_changes:
        try:
            ticker = wc.ticker.upper().strip()
            if wc.action == "add":
                await db.add_to_watchlist(user_id, ticker)
                if market_source is not None:
                    await market_source.add_ticker(ticker)
            elif wc.action == "remove":
                await db.remove_from_watchlist(user_id, ticker)
                if market_source is not None:
                    await market_source.remove_ticker(ticker)
        except Exception:
            pass

    executed_actions = {
        "trades": [t.model_dump() for t in llm_response.trades],
        "watchlist_changes": [w.model_dump() for w in llm_response.watchlist_changes],
        "trade_results": trade_results,
    }

    await db.save_chat_message(user_id, "assistant", llm_response.message, executed_actions)

    return {
        "message": llm_response.message,
        "trades": [t.model_dump() for t in llm_response.trades],
        "watchlist_changes": [w.model_dump() for w in llm_response.watchlist_changes],
        "trade_results": trade_results,
    }
