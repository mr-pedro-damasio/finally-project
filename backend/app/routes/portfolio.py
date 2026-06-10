from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import app.database as db
from app.portfolio import execute_trade, get_portfolio

router = APIRouter()


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str


@router.get("/api/portfolio")
async def get_portfolio_route(request: Request):
    price_cache = request.app.state.price_cache
    return await get_portfolio(price_cache)


@router.post("/api/portfolio/trade")
async def trade(body: TradeRequest, request: Request):
    price_cache = request.app.state.price_cache
    try:
        result = await execute_trade(body.ticker, body.side, body.quantity, price_cache)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.get("/api/portfolio/history")
async def portfolio_history():
    return await db.get_portfolio_history(limit=500)
