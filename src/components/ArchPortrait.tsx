import { useId } from 'react';
import type { ScenarioId } from '../../shared/types.ts';

interface Look {
  bg: [string, string];
  glow: string;
  skin: [string, string];
  cloth: [string, string];
  hair: string;
  leaf: string;
  style: 'short' | 'bun' | 'bob' | 'long';
}

/**
 * A drawn stand-in for the counterpart of each scenario. The real face is generated once the call starts,
 * so the start screen and the wait for the portrait both use these.
 */
const LOOKS: Record<ScenarioId, Look> = {
  sales: { bg: ['#8a5a36', '#241509'], glow: '#ffd9a0', skin: ['#d9a478', '#8d5d3c'], cloth: ['#4a5a34', '#1d2714'], hair: '#2a1b12', leaf: '#9bc25a', style: 'short' },
  defense: { bg: ['#2c5a52', '#081715'], glow: '#bfe8d8', skin: ['#e3b690', '#9a6a4a'], cloth: ['#2e4538', '#0f1c15'], hair: '#a39a8c', leaf: '#8fd0b8', style: 'bun' },
  salary: { bg: ['#7a7a2c', '#1a1a08'], glow: '#f2e08a', skin: ['#ebbb94', '#a8734f'], cloth: ['#8a4a30', '#34190e'], hair: '#4a2e1c', leaf: '#c9d65a', style: 'bob' },
  pitch: { bg: ['#2e5a34', '#08170d'], glow: '#dff07a', skin: ['#c88a62', '#7a4a30'], cloth: ['#1f4a2c', '#0b1c11'], hair: '#17100c', leaf: '#8fd05a', style: 'long' },
};

const HAIR: Record<Look['style'], string> = {
  short: 'M100 186 C 94 130, 206 130, 200 186 C 196 156, 176 142, 150 142 C 124 142, 104 156, 100 186 Z',
  bun: 'M100 186 C 94 130, 206 130, 200 186 C 196 156, 176 142, 150 142 C 124 142, 104 156, 100 186 Z',
  bob: 'M96 200 C 88 120, 212 120, 204 200 C 204 230, 196 246, 186 252 L 178 190 C 170 160, 130 160, 122 190 L 114 252 C 104 246, 96 230, 96 200 Z',
  long: 'M94 196 C 86 118, 214 118, 206 196 C 214 250, 224 290, 232 322 L 190 300 L 178 188 C 170 158, 130 158, 122 188 L 110 300 L 68 322 C 76 290, 86 250, 94 196 Z',
};

/** With a known gender the stand-in is short-haired for a man and never short-haired for a woman. */
export function ArchPortrait({ scenario, gender }: { scenario: ScenarioId; gender?: 'm' | 'f' }) {
  const base = LOOKS[scenario];
  const style = gender === 'm' ? 'short' : gender === 'f' && base.style === 'short' ? 'bob' : base.style;
  const look = { ...base, style };
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}${name})`;
  return (
    <svg viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={look.bg[0]} />
          <stop offset="1" stopColor={look.bg[1]} />
        </linearGradient>
        <radialGradient id={`${id}gl`} cx="24%" cy="14%" r="75%">
          <stop offset="0" stopColor={look.glow} stopOpacity=".5" />
          <stop offset="1" stopColor={look.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}sk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={look.skin[0]} />
          <stop offset="1" stopColor={look.skin[1]} />
        </linearGradient>
        <linearGradient id={`${id}cl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.cloth[0]} />
          <stop offset="1" stopColor={look.cloth[1]} />
        </linearGradient>
        <linearGradient id={`${id}ms`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07100b" stopOpacity="0" />
          <stop offset="1" stopColor="#07100b" stopOpacity=".92" />
        </linearGradient>
      </defs>
      <rect width="300" height="380" fill={ref('bg')} />
      <rect width="300" height="380" fill={ref('gl')} />
      <path d="M30 250 C 8 196, 40 146, 92 138 C 104 190, 84 238, 30 250 Z" fill={look.leaf} opacity=".16" />
      <path d="M232 60 C 286 78, 296 140, 262 190 C 224 160, 214 100, 232 60 Z" fill={look.leaf} opacity=".12" />
      <path d="M-10 380 C -4 300, 64 268, 150 268 C 236 268, 304 300, 310 380 Z" fill={ref('cl')} />
      <path d="M130 274 L150 330 L170 274" fill="none" stroke="#c9d9b0" strokeWidth="3" strokeLinejoin="round" opacity=".35" />
      <path d="M124 238 L176 238 L172 280 C 160 292, 140 292, 128 280 Z" fill={ref('sk')} />
      <ellipse cx="150" cy="254" rx="32" ry="10" fill="#000" opacity=".22" />
      <ellipse cx="150" cy="190" rx="50" ry="62" fill={ref('sk')} />
      <path d="M150 128 C 192 130, 206 172, 196 212 C 190 238, 170 252, 150 252 C 176 230, 184 160, 150 128 Z" fill="#000" opacity=".16" />
      <path d={HAIR[look.style]} fill={look.hair} />
      {look.style === 'bun' && <circle cx="150" cy="122" r="21" fill={look.hair} />}
      <rect y="220" width="300" height="160" fill={ref('ms')} />
      <path d="M-30 -20 C 30 10, 84 50, 96 120 C 40 104, -14 66, -30 -20 Z" fill="#030804" opacity=".45" />
      <path d="M300 -10 C 270 40, 262 96, 276 150 C 306 108, 316 50, 300 -10 Z" fill="#030804" opacity=".4" />
    </svg>
  );
}
