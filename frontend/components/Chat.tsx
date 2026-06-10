import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { fetchChatHistory, sendChatMessage } from '@/lib/api';
import { colors, sectionHeader, inputStyle, gradientButton } from '@/styles/theme';

interface ChatProps {
  onWatchlistChange: () => void;
  onTradeComplete: () => void;
}

function TradeResult({ result }: {
  result: {
    ticker: string;
    side: string;
    quantity: number;
    success: boolean;
    price?: number;
    error?: string;
  }
}) {
  if (result.success) {
    return (
      <div style={{
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: '9999px',
        padding: '4px 10px',
        fontSize: '11px',
        color: colors.green,
        marginTop: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span>✓</span>
        {result.side === 'buy' ? 'Bought' : 'Sold'} {result.quantity} {result.ticker} @ ${result.price?.toFixed(2)}
      </div>
    );
  }
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '9999px',
      padding: '4px 10px',
      fontSize: '11px',
      color: colors.red,
      marginTop: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span>✗</span>
      Failed: {result.ticker} {result.side} {result.quantity} — {result.error}
    </div>
  );
}

function WatchlistChange({ change }: { change: { ticker: string; action: string } }) {
  return (
    <div style={{
      background: 'rgba(32,157,215,0.1)',
      border: '1px solid rgba(32,157,215,0.3)',
      borderRadius: '9999px',
      padding: '4px 10px',
      fontSize: '11px',
      color: colors.primary,
      marginTop: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span>{change.action === 'add' ? '+' : '−'}</span>
      {change.action === 'add' ? 'Added' : 'Removed'} {change.ticker} {change.action === 'add' ? 'to' : 'from'} watchlist
    </div>
  );
}

export default function Chat({ onWatchlistChange, onTradeComplete }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatHistory()
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(text);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.message,
        executed_actions: {
          trades: response.trades,
          watchlist_changes: response.watchlist_changes,
          trade_results: response.trade_results,
        },
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (response.trade_results?.some(r => r.success)) {
        onTradeComplete();
      }
      if (response.watchlist_changes?.length > 0) {
        onWatchlistChange();
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that — please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={sectionHeader}>
        <span style={{ color: colors.accent }}>AI</span> Assistant
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {loadingHistory && (
          <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            Loading history...
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            Ask FinAlly anything about your portfolio, or request trades.
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="msg-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '90%',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(32,157,215,0.18), rgba(32,157,215,0.06))'
                : colors.surfaceRaised,
              border: `1px solid ${msg.role === 'user' ? 'rgba(32,157,215,0.3)' : colors.border}`,
              borderRadius: '12px',
              padding: '9px 12px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: colors.text,
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            {msg.executed_actions && (
              <div style={{ maxWidth: '90%', width: '100%' }}>
                {msg.executed_actions.trade_results?.map((r, i) => (
                  <TradeResult key={i} result={r} />
                ))}
                {msg.executed_actions.watchlist_changes?.map((c, i) => (
                  <WatchlistChange key={i} change={c} />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '10px 14px',
            }}>
              <span className="thinking-dots">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} style={{
        padding: '10px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask FinAlly..."
          disabled={loading}
          className="themed-input"
          style={{ ...inputStyle, flex: 1, opacity: loading ? 0.7 : 1 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="gradient-button"
          style={{
            ...gradientButton(colors.secondary, '#4a2360'),
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
