import React, { useEffect, useRef } from 'react';
import { colors } from '@/styles/theme';

interface MainChartProps {
  ticker: string | null;
  history: Record<string, Array<{ time: number; value: number }>>;
}

export default function MainChart({ ticker, history }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;

    import('lightweight-charts').then((lc) => {
      if (!containerRef.current) return;

      chart = lc.createChart(containerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: 'transparent' },
          textColor: colors.textMuted,
        },
        grid: {
          vertLines: { color: colors.border },
          horzLines: { color: colors.border },
        },
        crosshair: {
          vertLine: { color: colors.primary },
          horzLine: { color: colors.primary },
        },
        rightPriceScale: {
          borderColor: colors.border,
        },
        timeScale: {
          borderColor: colors.border,
          timeVisible: true,
          secondsVisible: true,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(lc.AreaSeries, {
        lineColor: colors.primary,
        topColor: 'rgba(32, 157, 215, 0.28)',
        bottomColor: 'rgba(32, 157, 215, 0.0)',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceLineVisible: true,
        priceLineColor: colors.primary,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    });

    return () => {
      if (chart) {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !ticker) return;

    const data = history[ticker] || [];
    if (data.length === 0) {
      series.setData([]);
      return;
    }

    const seen = new Set<number>();
    const unique = data
      .filter(p => {
        if (seen.has(p.time)) return false;
        seen.add(p.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);

    series.setData(unique);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [ticker, history]);

  const data = ticker ? (history[ticker] || []) : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {!ticker && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '13px', zIndex: 1, pointerEvents: 'none',
        }}>
          Select a ticker to view chart
        </div>
      )}
      {ticker && data.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '13px', zIndex: 1, pointerEvents: 'none',
        }}>
          Waiting for price data for {ticker}...
        </div>
      )}
      <div style={{
        position: 'absolute', top: '12px', left: '16px',
        fontSize: '15px', fontWeight: 700, color: colors.text, zIndex: 1,
        pointerEvents: 'none',
      }}>
        {ticker}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
