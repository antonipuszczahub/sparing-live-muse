/** Remembers, in this browser, that the visitor has opened the Demo panel, so the start screen stops nudging towards it. */
const KEY = 'sl.about.seen';

export function hasSeenAbout(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: do not nudge on every visit
  }
}

export function markAboutSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* nothing to remember it with */
  }
}
