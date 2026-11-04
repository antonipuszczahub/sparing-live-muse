import type { Portraits } from './portrait.ts';

/** A character's face while it is being drawn: the neutral portrait first, then the two expressions edited from it. */
export interface PortraitJob {
  neutral: Promise<string>;
  rest: Promise<Pick<Portraits, 'cold' | 'warm'>>;
}

/**
 * The faces being drawn, by session. A request for the neutral portrait is answered as soon as that one image is
 * ready, without waiting for the expressions; a job that failed is forgotten so the next request draws again.
 * The drawing functions are passed in, which keeps this testable without the network.
 */
export function createPortraitJobs<I extends { session: string }>(
  drawNeutral: (input: I) => Promise<string>,
  drawExpressions: (neutral: string, session: string) => Promise<Pick<Portraits, 'cold' | 'warm'>>,
) {
  const jobs = new Map<string, PortraitJob>();
  return {
    get: (session: string) => jobs.get(session),
    start(input: I): PortraitJob {
      const neutral = drawNeutral(input);
      const rest = neutral.then((n) => drawExpressions(n, input.session));
      const job: PortraitJob = { neutral, rest };
      jobs.set(input.session, job);
      // both promises are handled here, so neither goes unhandled when the job fails
      Promise.all([neutral, rest]).catch(() => {
        if (jobs.get(input.session) === job) jobs.delete(input.session);
      });
      return job;
    },
  };
}
