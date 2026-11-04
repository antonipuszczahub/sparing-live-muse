/**
 * The looks the visitor can choose from. 'swiatlo' (dark, lit by bars of light) is the default; 'classic' is the earlier
 * light look and has no data-theme on the page.
 */
export const THEMES = ['swiatlo', 'classic', 'maison', 'atelier', 'galerie'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'swiatlo';

const KEY = 'sl.theme';

export function parseTheme(value: string | null | undefined): Theme | null {
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : null;
}

/** ?theme= wins (so a link can show a look), then what the visitor chose before, then the default. */
export function initialTheme(search = typeof location === 'undefined' ? '' : location.search): Theme {
  const fromUrl = parseTheme(new URLSearchParams(search).get('theme'));
  if (fromUrl) return fromUrl;
  try {
    return parseTheme(localStorage.getItem(KEY)) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: Theme, remember = true) {
  const root = document.documentElement;
  if (theme === 'classic') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  if (!remember) return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* not remembered, still applied for this visit */
  }
}
