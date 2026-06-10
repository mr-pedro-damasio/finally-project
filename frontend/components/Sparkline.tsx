import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  data: Array<{ time: number; value: number }>;
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({ data, width = 80, height = 30, color = '#209dd7' }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data.map((point, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((point.value - min) / range) * height * 0.85 - height * 0.075,
    }));

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }, [data, width, height, color]);

  if (data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: '1px', background: '#232633' }} />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
}
