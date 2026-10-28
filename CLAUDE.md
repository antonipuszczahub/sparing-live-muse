# Sparing Live (Muse) — working notes for Claude

Real-time voice sparring on Meta's Muse models, built for the Meta Global AI Developer Hackathon (26 Oct – 4 Nov 2026,
deadline 4 Nov 21:00 ET = 5 Nov 03:00 Polish time). You call a counterpart (buyer, examiner, manager, investor); it
listens, interrupts, reads your screen, shows its mood on a face, can hang up, and afterwards a reviewer shows what the
character was privately thinking. The README is the source of truth for what it is and the measured numbers.

This repository must contain only work done during the hackathon. Do not copy code from the earlier Polish prototype.

## Pitch rule

It is not a chatbot, and it is never described as one or as "possibly a generic chatbot". Sell the engineering: a
full-duplex voice loop with barge-in, specialised agents with hidden state, measured guarantees (`npm run eval`), a budget
ledger. Raise real risks as engineering decisions, not as doubts about the idea.

## Commands

| | |
|---|---|
| `npm run dev` | server on 8787 and Vite on 5173 (`.env` and `.env.local` are both read) |
| `npm run typecheck` / `npm test` / `npm run build` | must be green before anything is called done |
| `npm run check:meta` / `check:open` / `check:voice` | probe Meta, the open-weights host, ElevenLabs (saves WAV samples) |
| `npm run try:turn -- [--lang pl] [--open]` | scripted call against the live character |
| `npm run eval -- [--lang pl] [--open]` | 24 scripted calls, writes `docs/EVAL*.md` (open weights run two at a time: Baseten allows 100 requests a minute) |
| `npm run manifest` | rebuilds `docs/MANIFEST.md` from `data/manifest.jsonl`; regenerate before submission |

## How it is built

- **Live turn.** Browser `CallEngine` (turn taking, barge-in, silence, hang-up) -> `/api/turn` (SSE) -> `characterTurn`
  streams tagged text `THOUGHT / MOOD / SAY / HANGUP` (JSON mode neither streams nor keeps key order). Speech starts
  while the model is still writing.
- **Agents** in `server/agents/`: character, twin (web research with Wonder, cached 24 h), eye (reads the shared
  screen), auditor (review), portrait (Muse Image), sam (camera framing). All calls go through `server/meta/client.ts`
  and are written to the ledger (`server/meta/ledger.ts`), which also enforces the daily and per-session budget.
- **Two languages.** `Lang = 'en' | 'pl'` is on `SessionConfig`. Polish content lives in `*.pl.ts` files; Polish text
  addressed to a character carries `{m|f}` gender markers resolved with `gendered()` (`shared/lang.ts`). The start
  screen asks the user's gender and Pan/Pani vs ty because Polish verbs carry gender. UI text is in `src/i18n/`:
  `en.ts` defines the keys and `pl.ts` is typed with them, so a missing string does not compile.
- **Voice of the character.** Meta has no speech synthesis. Either the browser's voices (`src/lib/tts.ts`, picker in
  `VoicePicker.tsx`, lists filtered by gender) or ElevenLabs (`server/tts/`, `src/lib/cloudSpeaker.ts`): sentences are
  requested as they stream in, played back to back on the audio clock, with the browser voice as fallback. A character gets one of
  the approved voices (`APPROVED` in `server/tts/elevenlabs.ts`, listened to by the user) from its seed. Caps in
  characters per session, visitor and day.
- **Open weights.** `server/meta/open.ts` picks the host (Baseten, Fireworks, Modal, Ollama). Muse Spark Open always
  reasons; the Baseten preset sends `reasoning_effort: low` (xhigh is 3x slower and sometimes returns nothing). A failing
  host falls back to Spark before the character has spoken, and the call says so.

## Adding things

- **A scenario:** `ScenarioId` in `shared/types.ts`; an entry in `shared/scenarios.ts` and `shared/scenarios.pl.ts`; four pools
  per language in `shared/variation.ts` and `variation.pl.ts` (circumstances, agendas, roles with bios); BRIEF text per
  language in `server/agents/twin.ts`; portrait setting and English role in `server/agents/portrait.ts`; the
  `z.enum` follows `SCENARIO_IDS`. Then typecheck, tests, and `npm run eval`.
- **A language:** `Lang` and `LANG_META` (ASR name, speech tag); scenarios, variation pools, the prompts of the character,
  twin, eye and auditor; a dictionary typed with `en.ts`; fillers in `shared/audit.ts`; texts in `shared/framing.ts`
  and `shared/notes.ts`; stop words in `src/lib/text.ts`; voice names in `src/lib/tts.ts`; tests; `eval --lang`.
- **Level behaviour** always goes through `levelDef(level, lang)` and scenarios through `scenarioDef(id, lang)`.

## Measured facts that shaped the design

- Reasoning tokens count against `max_tokens`; live turns use 900 (2500 on open weights).
- `json_schema` does not stream and returns keys alphabetically. Web search exists only on the Responses API.
- Voice Transcribe: key in the first JSON frame, PCM 24 kHz in 80 ms frames, `ENDPOINTING` mode; it detects language by
  itself, `languageBias` only sharpens it (Polish came back word for word).
- Muse Spark in Polish: median first word 1.6 s (English 1.1 s) because Polish uses more tokens; the private thought is
  capped at 12 words in Polish for that reason.
- Wonder sometimes puts the outcome word ("lost") in the audit `verdict`; `ensureVerdict` repairs it.
- Model ids and prices are in `server/meta/models.ts`; ElevenLabs price used for estimates is `ELEVENLABS_USD_PER_1K_CHARS`.

## How to work here

- Build features whole (data, prompts, UI, server validation, tests, README), not as sketches. Then verify: `npm run
  typecheck`, `npm test`, look at UI changes in the browser, and for model behaviour run the live check or `eval`. Say plainly
  what was not verified (for example sound, a real microphone, a host that was not reachable).
- Test the pure parts without the network (the playback queue runs on a fake audio clock, the routes against a stand-in
  service) and test the live behaviour with the scripts.
- Keys live in `.env` and `.env.local` (both gitignored). Never print, commit or paste one; check a diff for key values
  before committing. Services that cost money go through the ledger and have caps.
- English for the product, docs and code comments; Polish only where the Polish product needs it.
