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
| `npm run check:meta` / `check:open` | probe the Meta Model API and the open-weights host |
| `npm run try:turn -- [--lang pl] [--open]` | scripted call against the live character |
| `npm run eval -- [--lang pl] [--open]` | 24 scripted calls, writes `docs/EVAL*.md` (open weights run two at a time: Baseten allows 100 requests a minute) |
| `npm run eval:inject` | prompt-injection probe (planted instructions in web research and screen text, EN and PL, Spark and open weights), writes `docs/EVAL.inject.md` |
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
- **Interface.** The look is **Światło** (`src/themes.css`, `<html data-theme="swiatlo">`), and it is final: the user
  picked its palette from seven mock-ups on 4 Nov 2026 (a Raycast-like page: near-black, blurred slanted bars of orange,
  amber and crimson light under a veil of white film grain, dark glass cards, dark glass pills with a glow) and wanted
  everything else as it was: same layout, same Figtree, same orange accent. There is no look switcher and no other look
  (an earlier picker and three serif looks were removed at the user's request; git history has them). Surfaces that were
  white glass or black ink on the earlier light look are tokens with that value as the fallback
  (`var(--glass, rgba(255, 255, 255, 0.72))`) and `themes.css` defines them: keep that pattern. The paragraph below
  describes the shapes and the type, which are unchanged; its colours (warm grey page, black pills) are the earlier look.
  **Big screens:** from 1900 px wide the whole page is zoomed (`zoom` on `:root`, steps in `index.css`) so it fills a large
  monitor instead of sitting in a column. Chrome scales `vw`/`vh`/`vmax` with the zoom, so style sheets write them as
  `calc(N * var(--vw, 1vw))` (`--vw` is 1vw divided by the zoom); `tests/look.test.ts` fails on a raw viewport unit.
  Modelled on how Meta, Stripe and Linear look: ONE tight grotesque (Figtree, semibold, negative tracking;
  never a serif or a quirky display face), a calm warm-grey page (`--canopy`) that turns to orange at the bottom with drifting pools of
  light that lean towards the pointer (`Backdrop.tsx`), black pill buttons and segmented controls, white glass cards with 24px radius,
  ONE accent (`--brass` deep orange for small text, `--brass-hi` bright orange for light and the logo; the names are historical), ink
  for text. Real photographs, not drawings: the start screen shows four archetype portraits (`public/archetypes`, made by
  `npm run make:archetypes`) and the call shows the generated face. The logo is a fast S with soft edges in FLAT orange (no gradient, no glow; its lower stroke curves like a smile), drawn from the user's own sketch, and it IS the
  first letter: the wordmark is that S followed by "paring Live" (`Brand.tsx`; on a flat black square, with no glow, shadow or gloss, it is the app icon: `public/favicon.svg`, `icon-*.png`, `apple-touch-icon.png`, `manifest.webmanifest`). Do not bring back the dark jungle look, serif headings, vines, square corners or cartoon faces:
  the user rejected three earlier looks. The call sets `--mood`/`--mc` on `:root` (`useMoodTheme`); `--mc` is a registered
  `@property`, so colour changes fade. Each screen is a container (server, state) plus a `*View` that only draws; styles are CSS modules
  next to them and `ui.module.css` holds the shared pieces. Pure layout code (`captions.ts`, `moodVine.ts`) is tested. A glass panel
  inside an element with `opacity < 1` or `filter` stops blurring what is behind it, so `.screen` enters with a transform only. `/?fx=…`
  (dev server only, `src/dev/fixtures.tsx`) shows the call, review and research screens with fake data (the call screens still draw a
  real face once per server start, about 3 cents). The font comes from Google Fonts in `index.html`.
- **Voice of the character.** Meta has no speech synthesis, and the hackathon allows only Meta models at runtime, so the
  submitted voice is the browser's own (`src/lib/tts.ts`, picker in `VoicePicker.tsx`, lists filtered by gender; Edge
  Natural voices rank first). There is no third-party speech service in the code at all (an earlier optional ElevenLabs path
  was removed; git history has it). README says which parts are OS/browser features and which are Meta model calls.
- **Around the call.** Start screen: the Demo button opens `AboutSheet` (text in `src/i18n/about.ts`: what it is, what to watch, what it runs on, plans marked "not built yet") whose button fills the demo call; "Voice and microphone" sheet = `VoicePicker` + `MicPicker` (`src/lib/mic.ts`: chosen device, fallback to the default, warning for virtual inputs like Voicemeeter) + `AudioCheck` (`src/lib/audioCheck.ts`: output looks like headphones?, does the mic hear you, does it hear the character; pure judging functions are tested). In the call: mute (button and M, `CallEngine.setMuted`), `EchoWatch` hint when the character seems to hear itself. Review: measured numbers from the transcript only (`measureDelivery`: fillers, `countRepeats`, interruptions; no pause or voice analysis, say so if asked) and a Wording section of up to five language slips (`kind` grammar or register: too casual for the conversation, and in Polish `ty` to a character addressed as Pan/Pani) that `cleanWording` keeps only when the quoted words are really in that user line and `markWording` underlines in the replay; copy as Markdown (`src/lib/reviewText.ts`), "Again with <name>" (`src/lib/redial.ts`, same seed, new session), retry when the audit fails, long summary behind a button. Scores of finished calls: `src/lib/history.ts` (browser only). Dev server is shared with a phone by `npm run phone` (Tailscale serve, HTTPS, tailnet only); requests from this machine are not rate limited in development.
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
- Hosted Muse Spark first-word latency varies by day: 1.1 s EN / 1.6 s PL on 28 Oct, 2.4-2.6 s in both languages on 4 Nov
  (same prompts took about 1 s on open weights that day, so default to open weights and quote dated numbers).
- Muse Spark in Polish uses more tokens than English (open weights: 1.5 s vs 1.2 s); the private thought is
  capped at 12 words in Polish for that reason.
- Wonder sometimes puts the outcome word ("lost") in the audit `verdict`; `ensureVerdict` repairs it.
- Model ids and prices are in `server/meta/models.ts`.

## How to work here

- Build features whole (data, prompts, UI, server validation, tests, README), not as sketches. Then verify: `npm run
  typecheck`, `npm test`, look at UI changes in the browser, and for model behaviour run the live check or `eval`. Say plainly
  what was not verified (for example sound, a real microphone, a host that was not reachable).
- Test the pure parts without the network (the playback queue runs on a fake audio clock, the routes against a stand-in
  service) and test the live behaviour with the scripts.
- Keys live in `.env` and `.env.local` (both gitignored). Never print, commit or paste one; check a diff for key values
  before committing. Services that cost money go through the ledger and have caps.
- English for the product, docs and code comments; Polish only where the Polish product needs it.
