import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Chat from '@/components/Chat';

jest.mock('@/lib/api', () => ({
  fetchChatHistory: jest.fn().mockResolvedValue([
    { role: 'user', content: 'What is my portfolio worth?', executed_actions: null, created_at: '2024-01-01' },
    { role: 'assistant', content: 'Your portfolio is worth $10,000.', executed_actions: { trades: [], watchlist_changes: [], trade_results: [] }, created_at: '2024-01-01' },
  ]),
  sendChatMessage: jest.fn().mockResolvedValue({
    message: 'Done!',
    trades: [],
    watchlist_changes: [],
    trade_results: [],
  }),
}));

describe('Chat', () => {
  const defaultProps = {
    onWatchlistChange: jest.fn(),
    onTradeComplete: jest.fn(),
  };

  it('renders chat panel', () => {
    render(<Chat {...defaultProps} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('loads and displays history', async () => {
    render(<Chat {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('What is my portfolio worth?')).toBeInTheDocument();
      expect(screen.getByText('Your portfolio is worth $10,000.')).toBeInTheDocument();
    });
  });

  it('renders input and send button', () => {
    render(<Chat {...defaultProps} />);
    expect(screen.getByPlaceholderText('Ask FinAlly...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('shows trade result confirmations', async () => {
    const { fetchChatHistory } = require('@/lib/api');
    fetchChatHistory.mockResolvedValueOnce([
      {
        role: 'assistant',
        content: 'Bought shares for you.',
        executed_actions: {
          trades: [{ ticker: 'AAPL', side: 'buy', quantity: 10 }],
          watchlist_changes: [],
          trade_results: [{ ticker: 'AAPL', side: 'buy', quantity: 10, success: true, price: 190.5 }],
        },
      },
    ]);
    render(<Chat {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Bought 10 AAPL/)).toBeInTheDocument();
    });
  });
});
