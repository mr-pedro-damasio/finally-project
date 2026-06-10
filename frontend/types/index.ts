export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: 'up' | 'down' | 'flat';
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions: Position[];
}

export interface WatchlistItem {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  added_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  executed_actions?: {
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
  } | null;
  created_at?: string;
}

export interface SnapshotPoint {
  total_value: number;
  recorded_at: string;
}
