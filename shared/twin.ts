import type { SessionConfig, TwinProfile } from './types.ts';

/** Attach a researched company to a session: the counterpart now works there. */
export function applyTwin(config: SessionConfig, twin: TwinProfile): SessionConfig {
  return {
    ...config,
    twin,
    persona: { ...config.persona, role: `${twin.buyerRole} at ${twin.company}`, bio: twin.buyerBio },
  };
}
