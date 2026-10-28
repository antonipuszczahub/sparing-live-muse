# Manifest

Generated 2026-10-28 from `data/manifest.jsonl`, the server's budget ledger. Every model call is appended there with its model, tokens, cost and latency; no prompts, transcripts or audio are recorded.

**1,162** model calls across **59** sessions, 2026-10-28. Cost billed by Meta: **$2.63**.

## By model

| Model | Served by | Calls | Input tokens | Output tokens | Cost | First token (median) | Total (p95) |
|---|---|---|---|---|---|---|---|
| `muse-spark-1.3-contributor` | Meta Model API | 22 | 10,526 | 3,307 | $0.001 | 2403 ms | 5384 ms |
| `muse-wonder-1.0` | Meta Model API | 21 | 229,476 | 38,101 | $1.38 | n/a | 30978 ms |
| `muse-spark-1.3` | Meta Model API | 562 | 453,718 | 116,980 | $0.880 | 1300 ms | 3023 ms |
| `muse-voice-transcribe-1.0` | Meta Model API | 8 | 0 | 0 | $0.006 | n/a | 21290 ms |
| `muse-image-1.0` | Meta Model API | 36 | 0 | 0 | $0.360 | n/a | 18568 ms |
| `sam-3.1` | Meta Model API | 1 | 0 | 0 | $0.003 | n/a | 2737 ms |
| `meta-models/muse-spark-open-1026` | open weights | 512 | 437,995 | 219,654 | $0.000 | 1448 ms | 5759 ms |

## By role

| Role | Model | Calls | Cost |
|---|---|---|---|
| Live counterpart (streamed turns) | `muse-spark-1.3-contributor`, `muse-spark-1.3`, `meta-models/muse-spark-open-1026` | 1,089 | $0.875 |
| Face: portrait | `muse-image-1.0` | 20 | $0.200 |
| Face: expression edit | `muse-image-1.0` | 16 | $0.160 |
| Post-call audit | `muse-wonder-1.0` | 15 | $0.560 |
| Realtime transcription | `muse-voice-transcribe-1.0` | 8 | $0.006 |
| API probe | `muse-spark-1.3-contributor`, `muse-wonder-1.0` | 5 | $0.000 |
| Digital twin research with web search | `muse-wonder-1.0` | 5 | $0.823 |
| Eye: reads the shared screen | `muse-spark-1.3` | 2 | $0.006 |
| Camera framing: face detection | `sam-3.1` | 1 | $0.003 |
| Open-weights probe | `meta-models/muse-spark-open-1026` | 1 | $0.000 |

## Open weights

| Open-weights model | Calls | Character turns on open weights | Input tokens | Output tokens | First token (median) |
|---|---|---|---|---|---|
| `meta-models/muse-spark-open-1026` | 512 | 511 of 1,089 (47%) | 437,995 | 219,654 | 1448 ms |

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
