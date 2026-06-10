import React, { useEffect, useRef, useState } from 'react';
import { SnapshotPoint } from '@/types';
import { fetchPortfolioHistory } from '@/lib/api';
import { colors } from '@/styles/theme';

interface PnLChartProps {
  refreshTrigger?: number;
}

export default function PnLChart({ refreshTrigger }: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const [snapshots, setSnapshots] = useState<SnapshotPoint[]>([]);

  useEffect(() => {
    fetchPortfolioHistory()
      .then(setSnapshots)
      .catch(() => {});
  }, [refreshTrigger]);

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
        rightPriceScale: {
          borderColor: colors.border,
        },
        timeScale: {
          borderColor: colors.border,
          timeVisible: true,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(lc.AreaSeries, {
        lineColor: colors.accent,
        topColor: 'rgba(236, 173, 10, 0.28)',
        bottomColor: 'rgba(236, 173, 10, 0.0)',
        lineWidth: 2,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
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
    if (!series || snapshots.length === 0) return;

    const seen = new Set<number>();
    const data = snapshots
      .map(s => ({
        time: Math.floor(new Date(s.recorded_at).getTime() / 1000) as number,
        value: s.total_value,
      }))
      .filter(p => {
        if (seen.has(p.time)) return false;
        seen.add(p.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);

    series.setData(data);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [snapshots]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {snapshots.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMuted, fontSize: '12px', zIndex: 1, pointerEvents: 'none',
        }}>
          No portfolio history yet
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
