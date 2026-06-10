import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.market import PriceCache, create_market_data_source, create_stream_router
from app.database import init_db, get_watchlist
from app.routes.health import router as health_router
from app.routes.watchlist import router as watchlist_router
from app.routes.portfolio import router as portfolio_router
from app.routes.chat import router as chat_router

price_cache = PriceCache()


async def _snapshot_loop(app: FastAPI):
    from app.portfolio import record_snapshot
    while True:
        await asyncio.sleep(30)
        try:
            await record_snapshot(app.state.price_cache)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    tickers = [row["ticker"] for row in await get_watchlist()]
    market_source = create_market_data_source(price_cache)
    await market_source.start(tickers)
    app.state.market_source = market_source
    app.state.price_cache = price_cache

    snapshot_task = asyncio.create_task(_snapshot_loop(app))

    yield

    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass
    await market_source.stop()


app = FastAPI(lifespan=lifespan)

stream_router = create_stream_router(price_cache)
app.include_router(stream_router)
app.include_router(health_router)
app.include_router(watchlist_router)
app.include_router(portfolio_router)
app.include_router(chat_router)

STATIC_DIR = os.environ.get("STATIC_DIR", "/app/static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
