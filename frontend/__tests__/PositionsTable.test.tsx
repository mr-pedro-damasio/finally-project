import React from 'react';
import { render, screen } from '@testing-library/react';
import PositionsTable from '@/components/PositionsTable';
import { Position } from '@/types';

jest.mock('@/lib/api', () => ({
  executeTrade: jest.fn().mockResolvedValue({ success: true, ticker: 'AAPL', side: 'buy', quantity: 10, price: 190.5 }),
}));

const mockPositions: Position[] = [
  {
    ticker: 'AAPL',
    quantity: 10,
    avg_cost: 185.0,
    current_price: 190.0,
    unrealized_pnl: 50.0,
    pnl_percent: 2.7,
  },
  {
    ticker: 'TSLA',
    quantity: 5,
    avg_cost: 250.0,
    current_price: 230.0,
    unrealized_pnl: -100.0,
    pnl_percent: -8.0,
  },
];

describe('PositionsTable', () => {
  it('renders positions', () => {
    render(<PositionsTable positions={mockPositions} onTradeComplete={jest.fn()} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('shows no positions message when empty', () => {
    render(<PositionsTable positions={[]} onTradeComplete={jest.fn()} />);
    expect(screen.getByText('No positions')).toBeInTheDocument();
  });

  it('renders trade bar inputs', () => {
    render(<PositionsTable positions={mockPositions} onTradeComplete={jest.fn()} />);
    expect(screen.getByPlaceholderText('TICKER')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('QTY')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('shows positive P&L', () => {
    render(<PositionsTable positions={mockPositions} onTradeComplete={jest.fn()} />);
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByText('+2.70%')).toBeInTheDocument();
  });

  it('shows negative P&L', () => {
    render(<PositionsTable positions={mockPositions} onTradeComplete={jest.fn()} />);
    expect(screen.getByText('$-100.00')).toBeInTheDocument();
    expect(screen.getByText('-8.00%')).toBeInTheDocument();
  });
});
