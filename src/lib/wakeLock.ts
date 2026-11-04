interface Sentinel {
  release(): Promise<void>;
}

interface WakeLockHost {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}

interface DocLike {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Keeps the screen on while a call is running: a phone dims and locks after a while, which would drop the
 * microphone and the connection in the middle of a sentence. The browser releases the lock whenever the tab is hidden,
 * so it is asked for again when the tab comes back. Where the Wake Lock API does not exist, or refuses, nothing
 * happens. Returns the function that lets go.
 */
export function keepAwake(
  host: WakeLockHost | undefined = typeof navigator === 'undefined' ? undefined : (navigator as WakeLockHost),
  doc: DocLike | undefined = typeof document === 'undefined' ? undefined : document,
): () => void {
  let lock: Sentinel | null = null;
  let stopped = false;

  const ask = () => {
    if (stopped || lock || !host?.wakeLock || doc?.visibilityState === 'hidden') return;
    host.wakeLock
      .request('screen')
      .then((l) => {
        if (stopped) void l.release().catch(() => undefined);
        else lock = l;
      })
      .catch(() => undefined);
  };
  const onVisible = () => {
    lock = null; // the browser dropped it when the tab was hidden
    ask();
  };

  doc?.addEventListener('visibilitychange', onVisible);
  ask();
  return () => {
    stopped = true;
    doc?.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => undefined);
    lock = null;
  };
}
