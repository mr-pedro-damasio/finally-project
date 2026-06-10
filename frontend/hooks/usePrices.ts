import { useEffect, useRef, useState, useCallback } from 'react';
import { PriceUpdate } from '@/types';

interface PriceState {
  prices: Record<string, PriceUpdate>;
  firstSeen: Record<string, number>;
  history: Record<string, Array<{ time: number; value: number }>>;
  connected: boolean;
}

const MAX_HISTORY = 200;

export function usePrices() {
  const [state, setState] = useState<PriceState>({
    prices: {},
    firstSeen: {},
    history: {},
    connected: false,
  });

  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource('/api/stream/prices');
    esRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true }));
    };

    es.onmessage = (event) => {
      try {
        const batch: Record<string, PriceUpdate> = JSON.parse(event.data);
        setState(prev => {
          const newPrices = { ...prev.prices };
          const newFirstSeen = { ...prev.firstSeen };
          const newHistory = { ...prev.history };

          for (const ticker of Object.keys(batch)) {
            const update = batch[ticker];
            newPrices[ticker] = update;

            if (newFirstSeen[ticker] === undefined) {
              newFirstSeen[ticker] = update.price;
            }

            const tickerHistory = newHistory[ticker] ? [...newHistory[ticker]] : [];
            tickerHistory.push({ time: Math.floor(update.timestamp), value: update.price });
            if (tickerHistory.length > MAX_HISTORY) {
              tickerHistory.splice(0, tickerHistory.length - MAX_HISTORY);
            }
            newHistory[ticker] = tickerHistory;
          }

          return {
            prices: newPrices,
            firstSeen: newFirstSeen,
            history: newHistory,
            connected: true,
          };
        });
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }));
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  return state;
}
