import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '@/components/Header';
import { Portfolio } from '@/types';

const mockPortfolio: Portfolio = {
  cash_balance: 8500.0,
  total_value: 12000.0,
  positions: [],
};

describe('Header', () => {
  it('renders the FinAlly brand', () => {
    render(<Header portfolio={null} connected={false} />);
    expect(screen.getByText('ALLY')).toBeInTheDocument();
  });

  it('shows portfolio value when provided', () => {
    render(<Header portfolio={mockPortfolio} connected={true} />);
    expect(screen.getByText('$12,000.00')).toBeInTheDocument();
    expect(screen.getByText('$8,500.00')).toBeInTheDocument();
  });

  it('shows connected status', () => {
    render(<Header portfolio={null} connected={true} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows disconnected status', () => {
    render(<Header portfolio={null} connected={false} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
