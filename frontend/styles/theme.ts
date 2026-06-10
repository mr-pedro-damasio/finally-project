// frontend/styles/theme.ts
import { CSSProperties } from 'react';

export const colors = {
  bg: '#0d1117',
  surface: '#12141f',
  surfaceRaised: '#181b29',
  border: '#232633',
  text: '#e2e8f0',
  textMuted: '#7d869c',
  accent: '#ecad0a',
  primary: '#209dd7',
  secondary: '#753991',
  green: '#22c55e',
  red: '#ef4444',
} as const;

/** Rounded, elevated panel background. Apply to each top-level region. */
export const card: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02) inset',
  overflow: 'hidden',
};

/** Uppercase muted label bar at the top of a card. */
export const sectionHeader: CSSProperties = {
  padding: '10px 14px',
  borderBottom: `1px solid ${colors.border}`,
  fontSize: '11px',
  fontWeight: 600,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

/** Pill-shaped text input used in trade bar, watchlist add, and chat. */
export const inputStyle: CSSProperties = {
  background: colors.surfaceRaised,
  border: `1px solid ${colors.border}`,
  borderRadius: '9999px',
  color: colors.text,
  padding: '7px 14px',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
};

/** Gradient action button (Buy / Send / Add). Pass two hex colors for the gradient. */
export function gradientButton(from: string, to: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${from}, ${to})`,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };
}
