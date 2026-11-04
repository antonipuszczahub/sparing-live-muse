import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { rateLimit } from '../server/limits.ts';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function call(handler: ReturnType<typeof rateLimit>, ip: string) {
  const out = { passed: false, code: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      out.code = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  handler({ ip } as Request, res, () => {
    out.passed = true;
  });
  return out;
}

test('a visitor over the limit gets a 429 that says how long to wait, others are not affected', () => {
  const limit = rateLimit('t-basic', 2);
  assert.ok(call(limit, '1.1.1.1').passed);
  assert.ok(call(limit, '1.1.1.1').passed);
  const blocked = call(limit, '1.1.1.1');
  assert.equal(blocked.passed, false);
  assert.equal(blocked.code, 429);
  assert.match((blocked.body as { error: string }).error, /try again in about \d+ min/);
  assert.ok(call(limit, '2.2.2.2').passed, 'another visitor has their own allowance');
});

test('limits are kept per route name', () => {
  const a = rateLimit('t-route-a', 1);
  const b = rateLimit('t-route-b', 1);
  assert.ok(call(a, '3.3.3.3').passed);
  assert.equal(call(a, '3.3.3.3').passed, false);
  assert.ok(call(b, '3.3.3.3').passed, 'the other route is counted separately');
});

test('the allowance comes back once the window has passed', async () => {
  const limit = rateLimit('t-window', 1, 40);
  assert.ok(call(limit, '4.4.4.4').passed);
  assert.equal(call(limit, '4.4.4.4').passed, false);
  await wait(60);
  assert.ok(call(limit, '4.4.4.4').passed);
});

test('this machine is never limited in development, but a production deployment limits everyone', () => {
  const before = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    const dev = rateLimit('t-local-dev', 1);
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      for (let i = 0; i < 5; i++) assert.ok(call(dev, ip).passed, `${ip} is exempt in development`);
    }
    assert.ok(call(dev, '9.9.9.9').passed);
    assert.equal(call(dev, '9.9.9.9').passed, false, 'other addresses are still limited');

    process.env.NODE_ENV = 'production';
    const prod = rateLimit('t-local-prod', 1);
    assert.ok(call(prod, '127.0.0.1').passed);
    assert.equal(call(prod, '127.0.0.1').passed, false, 'behind a proxy on the same host everyone looks local, so production does not exempt it');
  } finally {
    if (before === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = before;
  }
});
