import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { postSSE } from '../src/lib/sse.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A response whose body arrives in the given byte chunks, like a network that splits wherever it likes. */
function serve(chunks: Uint8Array[], init: ResponseInit = {}) {
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const chunk of chunks) c.enqueue(chunk);
          c.close();
        },
      }),
      init,
    )) as typeof fetch;
}

async function collect() {
  const events: [string, unknown][] = [];
  await postSSE('/api/turn', { hello: 1 }, (e, d) => events.push([e, d]));
  return events;
}

test('events are parsed in order, with their names and JSON data', async () => {
  const text = 'event: say\ndata: {"delta":"Hello "}\n\nevent: say\ndata: {"delta":"there."}\n\nevent: final\ndata: {"reply":"Hello there.","mood":3}\n\n';
  serve([new TextEncoder().encode(text)]);
  assert.deepEqual(await collect(), [
    ['say', { delta: 'Hello ' }],
    ['say', { delta: 'there.' }],
    ['final', { reply: 'Hello there.', mood: 3 }],
  ]);
});

test('an event split across network chunks, even inside a multi-byte character, comes out whole', async () => {
  const bytes = new TextEncoder().encode('event: say\ndata: {"delta":"Dzień dobry, łódź."}\n\nevent: final\ndata: {"mood":4}\n\n');
  // cut inside the two bytes of "ń", and again between the two newlines that end the first event
  const cutA = bytes.indexOf(0xc5) + 1;
  const cutB = new TextDecoder().decode(bytes).indexOf('\n\n') + 1;
  const cutBytes = new TextEncoder().encode(new TextDecoder().decode(bytes).slice(0, cutB)).length;
  serve([bytes.slice(0, cutA), bytes.slice(cutA, cutBytes), bytes.slice(cutBytes)]);
  assert.deepEqual(await collect(), [
    ['say', { delta: 'Dzień dobry, łódź.' }],
    ['final', { mood: 4 }],
  ]);
});

test('a block with no data line is ignored and an unnamed event is called "message"', async () => {
  serve([new TextEncoder().encode(': keep-alive\n\ndata: {"a":1}\n\n')]);
  assert.deepEqual(await collect(), [['message', { a: 1 }]]);
});

test('the request is a JSON POST, and an error status rejects', async () => {
  let seen: RequestInit | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    seen = init;
    return new Response('nope', { status: 500 });
  }) as typeof fetch;
  await assert.rejects(collect(), /Server error 500/);
  assert.equal(seen?.method, 'POST');
  assert.equal(seen?.body, '{"hello":1}');
});
