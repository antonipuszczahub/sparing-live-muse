import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPortraitJobs } from '../server/agents/portraitJobs.ts';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const input = { session: 's_test' };

test('the neutral portrait is ready before the expressions', async () => {
  const jobs = createPortraitJobs(
    async () => 'neutral.webp',
    async () => {
      await wait(60);
      return { cold: 'cold.webp', warm: 'warm.webp' };
    },
  );
  const job = jobs.start(input);
  const first = await Promise.race([job.neutral.then(() => 'neutral'), job.rest.then(() => 'rest')]);
  assert.equal(first, 'neutral');
  assert.deepEqual(await job.rest, { cold: 'cold.webp', warm: 'warm.webp' });
});

test('the expressions are edited from the neutral portrait of the same session', async () => {
  const seen: [string, string][] = [];
  const jobs = createPortraitJobs(
    async () => 'the-neutral',
    async (neutral, session) => {
      seen.push([neutral, session]);
      return { cold: 'c', warm: 'w' };
    },
  );
  await jobs.start(input).rest;
  assert.deepEqual(seen, [['the-neutral', 's_test']]);
});

test('a second request for the same session reuses the job, and a failed job is forgotten', async () => {
  let draws = 0;
  let fail = true;
  const jobs = createPortraitJobs(
    async () => {
      draws++;
      if (fail) throw new Error('image api down');
      return 'neutral';
    },
    async () => ({ cold: 'c', warm: 'w' }),
  );
  const bad = jobs.start(input);
  await assert.rejects(bad.neutral);
  await wait(5);
  assert.equal(jobs.get('s_test'), undefined, 'the failed job is gone');
  fail = false;
  const good = jobs.start(input);
  assert.equal(await good.neutral, 'neutral');
  assert.equal(jobs.get('s_test'), good, 'the next request finds the new job');
  assert.equal(draws, 2);
});
