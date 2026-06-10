from app.market import PriceCache
import app.database as db

EPSILON = 1e-9


async def execute_trade(
    ticker: str,
    side: str,
    quantity: float,
    price_cache: PriceCache,
    user_id: str = "default",
) -> dict:
    update = price_cache.get(ticker)
    if update is None:
        raise ValueError(f"Ticker not found in price cache: {ticker}")

    price = update.price

    if side == "buy":
        cost = quantity * price
        cash = await db.get_cash_balance(user_id)
        if cost > cash + EPSILON:
            raise ValueError("Insufficient cash")

        positions = await db.get_positions(user_id)
        existing = next((p for p in positions if p["ticker"] == ticker), None)
        if existing:
            old_qty = existing["quantity"]
            old_avg = existing["avg_cost"]
            new_avg = (old_qty * old_avg + quantity * price) / (old_qty + quantity)
            new_qty = old_qty + quantity
        else:
            new_avg = price
            new_qty = quantity

        await db.upsert_position(user_id, ticker, new_qty, new_avg)
        new_cash = round(cash - cost, 2)
        await db.set_cash_balance(user_id, new_cash)

    elif side == "sell":
        positions = await db.get_positions(user_id)
        existing = next((p for p in positions if p["ticker"] == ticker), None)
        if not existing:
            raise ValueError(f"No position in {ticker}")

        held = existing["quantity"]
        if quantity > held + EPSILON:
            raise ValueError("Insufficient shares")

        quantity = min(quantity, held)
        remaining = held - quantity
        cash = await db.get_cash_balance(user_id)
        proceeds = quantity * price
        new_cash = round(cash + proceeds, 2)

        if remaining <= EPSILON:
            await db.delete_position(user_id, ticker)
        else:
            await db.upsert_position(user_id, ticker, remaining, existing["avg_cost"])

        await db.set_cash_balance(user_id, new_cash)

    else:
        raise ValueError(f"Invalid side: {side}")

    await db.record_trade(user_id, ticker, side, quantity, price)
    await record_snapshot(price_cache, user_id)

    return {
        "success": True,
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
    }


async def record_snapshot(price_cache: PriceCache, user_id: str = "default"):
    positions = await db.get_positions(user_id)
    cash = await db.get_cash_balance(user_id)
    total = cash
    for pos in positions:
        update = price_cache.get(pos["ticker"])
        if update:
            total += pos["quantity"] * update.price
    await db.record_portfolio_snapshot(user_id, round(total, 2))


async def get_portfolio(price_cache: PriceCache, user_id: str = "default") -> dict:
    positions = await db.get_positions(user_id)
    cash = await db.get_cash_balance(user_id)
    enriched = []
    total = cash
    for pos in positions:
        update = price_cache.get(pos["ticker"])
        current_price = update.price if update else pos["avg_cost"]
        unrealized_pnl = round((current_price - pos["avg_cost"]) * pos["quantity"], 2)
        pnl_pct = (
            round((current_price - pos["avg_cost"]) / pos["avg_cost"] * 100, 2)
            if pos["avg_cost"]
            else 0.0
        )
        total += pos["quantity"] * current_price
        enriched.append(
            {
                "ticker": pos["ticker"],
                "quantity": pos["quantity"],
                "avg_cost": pos["avg_cost"],
                "current_price": round(current_price, 2),
                "unrealized_pnl": unrealized_pnl,
                "pnl_percent": pnl_pct,
            }
        )
    return {
        "cash_balance": round(cash, 2),
        "total_value": round(total, 2),
        "positions": enriched,
    }
