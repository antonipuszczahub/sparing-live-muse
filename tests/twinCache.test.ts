import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeCompany, researchTwin, TwinCache, twinKey } from '../server/agents/twinCache.ts';
import type { TwinInput } from '../server/agents/twin.ts';
import type { ResponseStep } from '../server/meta/responses.ts';
import type { TwinProfile } from '../shared/types.ts';

const twin = (company: string): TwinProfile => ({
  company,
  buyerRole: 'Head of Product',
  buyerBio: 'Owns the roadmap.',
  summary: 'Makes software.',
  customers: 'Teams',
  pains: ['pricing'],
  objections: ['too expensive'],
  vocabulary: ['projects'],
  url: 'https://example.com',
  sources: [],
});

const input = (o: Partial<TwinInput> = {}): TwinInput => ({ company: 'basecamp.com', scenario: 'sales', topic: 'A website redesign', session: 's_test', ...o });

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'twins-'));
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the same company written differently is one key', () => {
  assert.equal(normalizeCompany('https://www.Basecamp.com/about/'), 'basecamp.com');
  assert.equal(normalizeCompany('  Acme   Corp '), 'acme corp');
  assert.equal(twinKey(input({ company: 'WWW.basecamp.com' })), twinKey(input()));
});

test('scenario and pitch change the key, because the objections depend on them', () => {
  assert.notEqual(twinKey(input({ scenario: 'pitch' })), twinKey(input()));
  assert.notEqual(twinKey(input({ topic: 'Something else' })), twinKey(input()));
  assert.equal(twinKey(input({ topic: '  a website   REDESIGN ' })), twinKey(input({ topic: 'A website redesign' })));
});

test('the second research is served from the cache and says so', async () => {
  const t = tmp();
  try {
    const cache = new TwinCache(t.dir, 3_600_000);
    let builds = 0;
    const build = async (_i: TwinInput, onStep: (s: ResponseStep) => void) => {
      builds += 1;
      onStep({ kind: 'search', text: 'basecamp pricing' });
      onStep({ kind: 'open', text: 'https://basecamp.com' });
      return twin('Basecamp');
    };

    const first = await researchTwin(input(), () => {}, { cache, build, paceMs: 0 });
    assert.equal(first.cached, false);

    const seen: ResponseStep[] = [];
    const second = await researchTwin(input({ company: 'https://www.basecamp.com/' }), (s) => seen.push(s), { cache, build, paceMs: 0 });
    assert.equal(second.cached, true);
    assert.equal(builds, 1, 'no second research');
    assert.equal(second.twin.company, 'Basecamp');
    assert.match(seen[0]!.text, /Using the research done/);
    assert.deepEqual(
      seen.slice(1).map((s) => s.kind),
      ['search', 'open'],
    );
  } finally {
    t.done();
  }
});

test('the cache survives a restart and expires after its time to live', async () => {
  const t = tmp();
  try {
    let clock = 1_000_000;
    const a = new TwinCache(t.dir, 1000, () => clock);
    a.put('k', { twin: twin('Acme'), steps: [], at: clock });

    const b = new TwinCache(t.dir, 1000, () => clock);
    assert.equal(b.get('k')?.twin.company, 'Acme', 'read back from disk by a new instance');

    clock += 1001;
    assert.equal(new TwinCache(t.dir, 1000, () => clock).get('k'), null, 'expired');
  } finally {
    t.done();
  }
});

test('a failed research is not cached, and null skips the cache', async () => {
  const t = tmp();
  try {
    const cache = new TwinCache(t.dir, 3_600_000);
    await assert.rejects(
      researchTwin(input(), () => {}, {
        cache,
        build: async () => {
          throw new Error('search failed');
        },
      }),
      /search failed/,
    );
    assert.equal(cache.has(twinKey(input())), false);

    let builds = 0;
    const build = async () => {
      builds += 1;
      return twin('Basecamp');
    };
    await researchTwin(input(), () => {}, { cache, build, paceMs: 0 });
    await researchTwin(input(), () => {}, { cache: null, build, paceMs: 0 });
    assert.equal(builds, 2, 'fresh research ignores the cache');
  } finally {
    t.done();
  }
});
