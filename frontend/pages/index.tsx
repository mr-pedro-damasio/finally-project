import React, { useState, useEffect, useCallback } from 'react';
import { Portfolio, WatchlistItem } from '@/types';
import { fetchPortfolio, fetchWatchlist } from '@/lib/api';
import { usePrices } from '@/hooks/usePrices';
import { card } from '@/styles/theme';
import Header from '@/components/Header';
import Watchlist from '@/components/Watchlist';
import MainChart from '@/components/MainChart';
import PortfolioHeatmap from '@/components/PortfolioHeatmap';
import PnLChart from '@/components/PnLChart';
import PositionsTable from '@/components/PositionsTable';
import Chat from '@/components/Chat';

export default function Home() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [tradeRefresh, setTradeRefresh] = useState(0);

  const { prices, firstSeen, history, connected } = usePrices();

  const refreshPortfolio = useCallback(() => {
    fetchPortfolio()
      .then(setPortfolio)
      .catch(() => {});
  }, []);

  const refreshWatchlist = useCallback(() => {
    fetchWatchlist()
      .then(data => {
        setWatchlistItems(data);
        if (!selectedTicker && data.length > 0) {
          setSelectedTicker(data[0].ticker);
        }
      })
      .catch(() => {});
  }, [selectedTicker]);

  useEffect(() => {
    refreshPortfolio();
    refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  const handleTradeComplete = useCallback(() => {
    refreshPortfolio();
    setTradeRefresh(n => n + 1);
  }, [refreshPortfolio]);

  // Sync portfolio positions with live prices
  const livePortfolio: Portfolio | null = portfolio ? {
    ...portfolio,
    positions: portfolio.positions.map(pos => {
      const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
      const pnl = (livePrice - pos.avg_cost) * pos.quantity;
      const pct = pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
      return {
        ...pos,
        current_price: livePrice,
        unrealized_pnl: pnl,
        pnl_percent: pct,
      };
    }),
    total_value: portfolio.cash_balance + portfolio.positions.reduce((sum, pos) => {
      const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
      return sum + pos.quantity * livePrice;
    }, 0),
  } : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0d1117',
      color: '#e2e8f0',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 1,
    }}>
      <Header portfolio={livePortfolio} connected={connected} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '12px', padding: '12px' }}>
        {/* Left: Watchlist */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
          <Watchlist
            items={watchlistItems}
            prices={prices}
            firstSeen={firstSeen}
            history={history}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onWatchlistChange={refreshWatchlist}
          />
        </div>

        {/* Center: Charts + Portfolio */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '12px' }}>
          {/* Top: Main chart */}
          <div style={{ flex: '0 0 45%', overflow: 'hidden', position: 'relative', ...card }}>
            <MainChart ticker={selectedTicker} history={history} />
          </div>

          {/* Bottom: Portfolio section */}
          <div style={{ flex: 1, display: 'flex', gap: '12px', overflow: 'hidden' }}>
            {/* Positions + Trade bar */}
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid #232633',
                fontSize: '11px',
                fontWeight: 600,
                color: '#7d869c',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                Positions
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PositionsTable
                  positions={livePortfolio?.positions || []}
                  onTradeComplete={handleTradeComplete}
                />
              </div>
            </div>

            {/* P&L chart + Heatmap */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative', ...card }}>
                <div style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#7d869c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 2,
                  background: '#12141f',
                  borderBottom: '1px solid #232633',
                }}>
                  P&L History
                </div>
                <div style={{ position: 'absolute', top: '34px', left: 0, right: 0, bottom: 0 }}>
                  <PnLChart refreshTrigger={tradeRefresh} />
                </div>
              </div>

              <div style={{ flex: '0 0 40%', overflow: 'hidden', position: 'relative', ...card }}>
                <div style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#7d869c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: '1px solid #232633',
                }}>
                  Portfolio Heatmap
                </div>
                <div style={{ overflow: 'auto', height: 'calc(100% - 38px)' }}>
                  <PortfolioHeatmap positions={livePortfolio?.positions || []} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...card }}>
          <Chat onWatchlistChange={refreshWatchlist} onTradeComplete={handleTradeComplete} />
        </div>
      </div>
    </div>
  );
}
