# Manifest

Generated 2026-11-04 from `data/manifest.jsonl`, the server's budget ledger. Every model call is appended there with its model, tokens, cost and latency; no prompts, transcripts or audio are recorded.

**1,963** model calls across **75** sessions, 2026-10-28 to 2026-11-04. Cost billed by Meta: **$4.22**.

## By model

| Model | Served by | Calls | Input tokens | Output tokens | Cost | First token (median) | Total (p95) |
|---|---|---|---|---|---|---|---|
| `muse-spark-1.3-contributor` | Meta Model API | 22 | 10,526 | 3,307 | $0.001 | 2403 ms | 5384 ms |
| `muse-wonder-1.0` | Meta Model API | 33 | 239,256 | 58,003 | $1.82 | n/a | 38668 ms |
| `muse-spark-1.3` | Meta Model API | 963 | 754,548 | 206,776 | $1.47 | 1646 ms | 3860 ms |
| `muse-voice-transcribe-1.0` | Meta Model API | 18 | 0 | 0 | $0.014 | n/a | 74309 ms |
| `muse-image-1.0` | Meta Model API | 91 | 0 | 0 | $0.910 | n/a | 18196 ms |
| `sam-3.1` | Meta Model API | 1 | 0 | 0 | $0.003 | n/a | 2737 ms |
| `meta-models/muse-spark-open-1026` | open weights | 835 | 740,951 | 292,703 | $0.000 | 1361 ms | 4855 ms |

## By role

| Role | Model | Calls | Cost |
|---|---|---|---|
| Live counterpart (streamed turns) | `muse-spark-1.3-contributor`, `muse-spark-1.3`, `meta-models/muse-spark-open-1026` | 1,812 | $1.47 |
| Face: expression edit | `muse-image-1.0` | 50 | $0.500 |
| Face: portrait | `muse-image-1.0` | 37 | $0.370 |
| Post-call audit | `muse-wonder-1.0` | 27 | $0.992 |
| Realtime transcription | `muse-voice-transcribe-1.0` | 18 | $0.014 |
| API probe | `muse-spark-1.3-contributor`, `muse-wonder-1.0` | 5 | $0.000 |
| Digital twin research with web search | `muse-wonder-1.0` | 5 | $0.823 |
| archetype | `muse-image-1.0` | 4 | $0.040 |
| Eye: reads the shared screen | `muse-spark-1.3` | 2 | $0.006 |
| Open-weights probe | `meta-models/muse-spark-open-1026` | 2 | $0.000 |
| Camera framing: face detection | `sam-3.1` | 1 | $0.003 |

## Open weights

| Open-weights model | Calls | Character turns on open weights | Input tokens | Output tokens | First token (median) |
|---|---|---|---|---|---|
| `meta-models/muse-spark-open-1026` | 835 | 833 of 1,812 (46%) | 740,951 | 292,703 | 1361 ms |

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
