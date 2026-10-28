import { BudgetError } from '../meta/client.ts';
import { ledger } from '../meta/ledger.ts';
import { FLAT_PRICES, MODELS } from '../meta/models.ts';

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Size of the source frame the box refers to. */
  w: number;
  h: number;
}

const BOX_RE = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>/g;

/**
 * SAM 3.1 segments "face" in one frame. We only use the bounding boxes: where the face is and how
 * large it is. Output is special-token text, one box followed by a mask per match; masks are skipped.
 */
export async function findFaces(image: string, session: string): Promise<Box[]> {
  const g = ledger.canSpend(session);
  if (!g.ok) throw new BudgetError(g.reason);
  const t0 = Date.now();
  const res = await fetch(`${process.env.META_BASE_URL || 'https://api.meta.ai/v1'}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELS.sam,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'face' }, { type: 'input_image', image_url: image }] }],
    }),
  });
  if (!res.ok) throw new Error(`SAM error ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { output?: { content?: { text?: string }[] }[] };
  const text = (json.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('');
  ledger.record({ kind: 'sam-face', model: MODELS.sam, session, costUsd: FLAT_PRICES.samPer1kImages / 1000, totalMs: Date.now() - t0 });
  return [...text.matchAll(BOX_RE)].map((m) => ({ x1: +m[1]!, y1: +m[2]!, x2: +m[3]!, y2: +m[4]!, w: +m[5]!, h: +m[6]! }));
}
