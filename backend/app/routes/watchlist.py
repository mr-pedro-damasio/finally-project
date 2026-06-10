from fastapi import APIRouter, Request
from pydantic import BaseModel

import app.database as db

router = APIRouter()


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("/api/watchlist")
async def get_watchlist(request: Request):
    price_cache = request.app.state.price_cache
    rows = await db.get_watchlist()
    result = []
    for row in rows:
        ticker = row["ticker"]
        update = price_cache.get(ticker)
        entry = {
            "ticker": ticker,
            "added_at": row["added_at"],
            "price": None,
            "previous_price": None,
            "change": None,
            "change_percent": None,
        }
        if update:
            entry["price"] = update.price
            entry["previous_price"] = update.previous_price
            entry["change"] = update.change
            entry["change_percent"] = update.change_percent
        result.append(entry)
    return result


@router.post("/api/watchlist")
async def add_ticker(body: AddTickerRequest, request: Request):
    ticker = body.ticker.upper().strip()
    if not ticker:
        return {"error": "Ticker cannot be empty"}, 400

    market_source = request.app.state.market_source
    try:
        await db.add_to_watchlist("default", ticker)
    except ValueError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": str(e)})

    await market_source.add_ticker(ticker)

    rows = await db.get_watchlist()
    for row in rows:
        if row["ticker"] == ticker:
            return {"ticker": ticker, "added_at": row["added_at"]}

    return {"ticker": ticker, "added_at": ""}


@router.delete("/api/watchlist/{ticker}")
async def remove_ticker(ticker: str, request: Request):
    ticker = ticker.upper().strip()
    market_source = request.app.state.market_source
    await db.remove_from_watchlist("default", ticker)
    await market_source.remove_ticker(ticker)
    return {"ticker": ticker, "removed": True}
