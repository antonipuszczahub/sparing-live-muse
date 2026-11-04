# Manifest

Generated 2026-11-03 from `data/manifest.jsonl`, the server's budget ledger. Every model call is appended there with its model, tokens, cost and latency; no prompts, transcripts or audio are recorded.

**1,244** model calls across **68** sessions, 2026-10-28 to 2026-11-03. Cost billed by Meta: **$3.27**.

## By model

| Model | Served by | Calls | Input tokens | Output tokens | Cost | First token (median) | Total (p95) |
|---|---|---|---|---|---|---|---|
| `muse-spark-1.3-contributor` | Meta Model API | 22 | 10,526 | 3,307 | $0.001 | 2403 ms | 5384 ms |
| `muse-wonder-1.0` | Meta Model API | 28 | 235,575 | 48,867 | $1.62 | n/a | 38668 ms |
| `muse-spark-1.3` | Meta Model API | 562 | 453,718 | 116,980 | $0.880 | 1300 ms | 3023 ms |
| `muse-voice-transcribe-1.0` | Meta Model API | 15 | 0 | 0 | $0.010 | n/a | 21290 ms |
| `muse-image-1.0` | Meta Model API | 76 | 0 | 0 | $0.760 | n/a | 18196 ms |
| `sam-3.1` | Meta Model API | 1 | 0 | 0 | $0.003 | n/a | 2737 ms |
| `meta-models/muse-spark-open-1026` | open weights | 540 | 464,478 | 224,555 | $0.000 | 1423 ms | 5750 ms |

## By role

| Role | Model | Calls | Cost |
|---|---|---|---|
| Live counterpart (streamed turns) | `muse-spark-1.3-contributor`, `muse-spark-1.3`, `meta-models/muse-spark-open-1026` | 1,116 | $0.875 |
| Face: expression edit | `muse-image-1.0` | 40 | $0.400 |
| Face: portrait | `muse-image-1.0` | 32 | $0.320 |
| Post-call audit | `muse-wonder-1.0` | 22 | $0.798 |
| Realtime transcription | `muse-voice-transcribe-1.0` | 15 | $0.010 |
| API probe | `muse-spark-1.3-contributor`, `muse-wonder-1.0` | 5 | $0.000 |
| Digital twin research with web search | `muse-wonder-1.0` | 5 | $0.823 |
| archetype | `muse-image-1.0` | 4 | $0.040 |
| Eye: reads the shared screen | `muse-spark-1.3` | 2 | $0.006 |
| Open-weights probe | `meta-models/muse-spark-open-1026` | 2 | $0.000 |
| Camera framing: face detection | `sam-3.1` | 1 | $0.003 |

## Open weights

| Open-weights model | Calls | Character turns on open weights | Input tokens | Output tokens | First token (median) |
|---|---|---|---|---|---|
| `meta-models/muse-spark-open-1026` | 540 | 538 of 1,116 (48%) | 464,478 | 224,555 | 1423 ms |

These calls were served by an open-weights host and billed by it, outside the Meta cost above.

## Voice

No ElevenLabs voice requests have been recorded. Without `ELEVENLABS_API_KEY` the character speaks with the browser voice.

## Reproduce

```bash
npm install
cp .env.example .env     # add MODEL_API_KEY, and an open-weights host if you have one
npm run check:meta       # probes the Meta Model API
npm run check:open       # probes the open-weights host
npm run eval             # 24 scripted calls, writes docs/EVAL.md
npm run manifest         # rebuilds this page from data/manifest.jsonl
```
