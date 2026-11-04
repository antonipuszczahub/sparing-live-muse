import type { SessionConfig } from '../../shared/types.ts';

/**
 * "Again with the same person": the same character, circumstances and hidden agenda (the config is reused as it is, so
 * the seed is the same), a fresh session so the cost, the face and the review of the second call stand on their own.
 * If the first call aimed at the user's weak spots, the second aims at the weak spots as they are now.
 */
export function redial(config: SessionConfig, weakNow: string[], now = Date.now()): { session: string; config: SessionConfig } {
  const session = `s_${config.variant.toString(36)}_${now.toString(36)}`;
  const aimed = Boolean(config.focus?.length);
  return { session, config: { ...config, focus: aimed && weakNow.length ? weakNow.slice(0, 3) : config.focus } };
}
