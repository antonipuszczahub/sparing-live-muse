import type { CSSProperties } from 'react';

/** Inline style with CSS custom properties, which React's own typing does not know about. */
export const vars = (v: Record<string, string | number>) => v as CSSProperties;
