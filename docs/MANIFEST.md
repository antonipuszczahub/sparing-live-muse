# Manifest

Generated 2026-10-28 from `data/manifest.jsonl`, the server's budget ledger. Every model call is appended there with its model, tokens, cost and latency; no prompts, transcripts or audio are recorded.

**341** model calls across **54** sessions, 2026-10-28. Cost billed by Meta: **$1.52**.

## By model

| Model | Served by | Calls | Input tokens | Output tokens | Cost | First token (median) | Total (p95) |
|---|---|---|---|---|---|---|---|
| `muse-spark-1.3-contributor` | Meta Model API | 22 | 10,526 | 3,307 | $0.001 | 2403 ms | 5384 ms |
| `muse-wonder-1.0` | Meta Model API | 12 | 169,769 | 21,281 | $0.902 | n/a | 32489 ms |
| `muse-spark-1.3` | Meta Model API | 281 | 179,134 | 57,296 | $0.398 | 1139 ms | 2148 ms |
| `muse-voice-transcribe-1.0` | Meta Model API | 4 | 0 | 0 | $0.003 | n/a | 17564 ms |
| `muse-image-1.0` | Meta Model API | 21 | 0 | 0 | $0.210 | n/a | 16874 ms |
| `sam-3.1` | Meta Model API | 1 | 0 | 0 | $0.003 | n/a | 2737 ms |

## By role

| Role | Model | Calls | Cost |
|---|---|---|---|
| Live counterpart (streamed turns) | `muse-spark-1.3-contributor`, `muse-spark-1.3` | 298 | $0.397 |
| Face: portrait | `muse-image-1.0` | 15 | $0.150 |
| Post-call audit | `muse-wonder-1.0` | 8 | $0.305 |
| Face: expression edit | `muse-image-1.0` | 6 | $0.060 |
| API probe | `muse-spark-1.3-contributor`, `muse-wonder-1.0` | 5 | $0.000 |
| Realtime transcription | `muse-voice-transcribe-1.0` | 4 | $0.003 |
| Digital twin research with web search | `muse-wonder-1.0` | 3 | $0.596 |
| Eye: reads the shared screen | `muse-spark-1.3` | 1 | $0.002 |
| Camera framing: face detection | `sam-3.1` | 1 | $0.003 |

## Open weights

No open-weights calls have been recorded yet. Set a host in `.env` (see `.env.example`), tick **Run the character on open weights** on the start screen, make a call, then run `npm run manifest` again.

## Reproduce

```bash
npm install
cp .env.example .env     # add MODEL_API_KEY, and an open-weights host if you have one
npm run check:meta       # probes the Meta Model API
npm run check:open       # probes the open-weights host
npm run eval             # 24 scripted calls, writes docs/EVAL.md
npm run manifest         # rebuilds this page from data/manifest.jsonl
```
