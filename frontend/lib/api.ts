import { Portfolio, WatchlistItem, SnapshotPoint, ChatMessage } from '@/types';

const API_BASE = '/api';

export async function fetchPortfolio(): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/portfolio`);
  if (!res.ok) throw new Error('Failed to fetch portfolio');
  return res.json();
}

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch(`${API_BASE}/watchlist`);
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function addToWatchlist(ticker: string): Promise<{ ticker: string; added_at: string }> {
  const res = await fetch(`${API_BASE}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add ticker');
  return data;
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  const res = await fetch(`${API_BASE}/watchlist/${encodeURIComponent(ticker)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to remove ticker');
  }
}

export async function executeTrade(
  ticker: string,
  side: 'buy' | 'sell',
  quantity: number
): Promise<{ success: boolean; ticker: string; side: string; quantity: number; price: number }> {
  const res = await fetch(`${API_BASE}/portfolio/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, side, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Trade failed');
  return data;
}

export async function fetchPortfolioHistory(): Promise<SnapshotPoint[]> {
  const res = await fetch(`${API_BASE}/portfolio/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chat/history`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function sendChatMessage(message: string): Promise<{
  message: string;
  trades: Array<{ ticker: string; side: string; quantity: number }>;
  watchlist_changes: Array<{ ticker: string; action: string }>;
  trade_results: Array<{
    ticker: string;
    side: string;
    quantity: number;
    success: boolean;
    price?: number;
    error?: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}
