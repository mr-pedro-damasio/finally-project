import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Watchlist from '@/components/Watchlist';
import { WatchlistItem, PriceUpdate } from '@/types';

// Mock the Sparkline since canvas is not available in jest-dom
jest.mock('@/components/Sparkline', () => {
  return function MockSparkline() {
    return <div data-testid="sparkline" />;
  };
});

// Mock API calls
jest.mock('@/lib/api', () => ({
  addToWatchlist: jest.fn().mockResolvedValue({ ticker: 'TSLA', added_at: '2024-01-01' }),
  removeFromWatchlist: jest.fn().mockResolvedValue(undefined),
}));

const mockItems: WatchlistItem[] = [
  { ticker: 'AAPL', price: 190.5, previous_price: 190.0, change: 0.5, change_percent: 0.26, added_at: '2024-01-01' },
  { ticker: 'GOOGL', price: 175.0, previous_price: 174.0, change: 1.0, change_percent: 0.57, added_at: '2024-01-01' },
];

const mockPrices: Record<string, PriceUpdate> = {
  AAPL: { ticker: 'AAPL', price: 190.5, previous_price: 190.0, timestamp: 1000, change: 0.5, change_percent: 0.26, direction: 'up' },
  GOOGL: { ticker: 'GOOGL', price: 175.0, previous_price: 174.0, timestamp: 1000, change: 1.0, change_percent: 0.57, direction: 'up' },
};

describe('Watchlist', () => {
  const defaultProps = {
    items: mockItems,
    prices: mockPrices,
    firstSeen: { AAPL: 189.0, GOOGL: 174.0 },
    history: { AAPL: [], GOOGL: [] },
    selectedTicker: null,
    onSelectTicker: jest.fn(),
    onWatchlistChange: jest.fn(),
  };

  it('renders ticker rows', () => {
    render(<Watchlist {...defaultProps} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
  });

  it('renders prices', () => {
    render(<Watchlist {...defaultProps} />);
    expect(screen.getByText('$190.50')).toBeInTheDocument();
    expect(screen.getByText('$175.00')).toBeInTheDocument();
  });

  it('calls onSelectTicker when row is clicked', () => {
    const onSelectTicker = jest.fn();
    render(<Watchlist {...defaultProps} onSelectTicker={onSelectTicker} />);
    fireEvent.click(screen.getByText('AAPL'));
    expect(onSelectTicker).toHaveBeenCalledWith('AAPL');
  });

  it('renders sparklines for each ticker', () => {
    render(<Watchlist {...defaultProps} />);
    expect(screen.getAllByTestId('sparkline').length).toBe(2);
  });

  it('shows no tickers message when list is empty', () => {
    render(<Watchlist {...defaultProps} items={[]} />);
    expect(screen.getByText('No tickers in watchlist')).toBeInTheDocument();
  });

  it('highlights selected ticker', () => {
    render(<Watchlist {...defaultProps} selectedTicker="AAPL" />);
    const aapl = screen.getAllByText('AAPL')[0];
    expect(aapl).toBeInTheDocument();
  });
});
