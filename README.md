# Sparing Live

![Sparing Live: rehearse the call you are afraid of](docs/img/social.png)

**Rehearse the conversation you are afraid of, against someone who talks back like a real person.**

Sparing Live is a real-time voice system built on Meta's Muse models, in English and in Polish. You call a counterpart (a skeptical buyer, a thesis examiner, your manager, an investor). It listens, thinks, interrupts you, reads your shared screen, changes its face with its mood, and can hang up. Afterwards a reviewer shows you exactly where you lost them, using what the character was privately thinking.

It is not a chatbot with a persona prompt. It is a pipeline of specialised agents with hidden state, a full-duplex voice loop, and measured guarantees (see [Evaluation](#evaluation)).

> Built for the Meta Global AI Developer Hackathon (26 Oct – 4 Nov 2026). Everything in this repository was written during the hackathon. An earlier Polish prototype on a local model existed before; this is a from-scratch rebuild on the Meta Model API, in English.

## What it looks like

![The start screen: four counterparts, a difficulty, and the Demo button](docs/img/start.jpg)

*Start screen. Pick a counterpart (the portraits are Muse Image output), a difficulty, optionally a real company to research. "Demo" opens a short panel on what the project is, what to watch and where it is going, with a button that fills in an investor pitch.*

![A call in progress: the counterpart's face, live captions, mood meter, and the call controls](docs/img/call.jpg)

*The call. The face is drawn by Muse Image and follows the character's mood (here: hostile). The shared-screen note, camera, and hang-up are in the dock; talking over the character stops it mid-sentence.*

![The review: score, the mood curve of the call with the two turning points, measured speech facts and skills](docs/img/review.jpg)

*The review. The curve is the character's private mood across the call; points A and B mark key moments (a strength and a mistake) that the review explains further down, where the replay shows the character's private thought on every turn. The call and review screens above were captured from the app's built-in sample call (`/?fx=call`, `/?fx=report`, development server only), so no model had to be paid for a screenshot; the portrait is a real Muse Image render.*

## What makes it different

| | |
|---|---|
| **Digital twin of a real company** | Type `basecamp.com`. Muse Wonder runs a live web-search research loop (searches, opens pages, cross-checks), and the person you call knows what the real company knows: its pricing problems, its launch, its vocabulary. Every search step is shown live. |
| **An opponent that can see** | Share a slide deck, code, or your portfolio. The eye agent reads the screen and the counterpart pounces on the weak slide: *"94% — compared to what?"* |
| **Mind reading** | Every reply carries a private thought and a mood that the user never hears. The post-call replay reveals them, so you see the exact sentence where "curious" turned into "losing him". |
| **A face that reacts** | Muse Image draws the counterpart once and edits the same person into three expressions. The face follows the character's mood during the call. |
| **Real interruptions** | Full-duplex voice, in both directions. Talk over the character and it stops mid-sentence; the transcript shows where it was cut off. And it cuts in on you: when you talk without a break for long enough (30 s at Realistic, 18 s at Tough, 12 s at Brutal, never at Friendly) it interrupts at your next breath with one short line, and your turn is marked as cut off. Tried with a made-up recogniser in the tests, not yet with a real microphone. |
| **No dead air** | The model needs about a second before its first word, and a person does not sit in silence for that long. When the model has not started within 0.65 s of a longer answer from you, the character says a short acknowledgement ("Hm.", "No tak.", "Right.") and the reply follows it; and the first clause of a long sentence is spoken before the sentence is finished. The reply itself does not arrive sooner, only the silence you hear is shorter; the latency shown in the review is still counted to the real first word. Never two exchanges in a row, never after a one-word answer. Tested with a made-up clock and voice, not yet heard through a real voice. |
| **An opponent that learns** | The auditor tags what you keep getting wrong ("dodged price", "vague intro"); the next character aims at it. |
| **Again, with the same person** | After the review, one click calls the same character again, with the same hidden agenda and aimed at your current weak spots, and the start screen keeps the scores of your last calls: the quickest way to see whether you improved. |
| **A clip you can post** | One click renders a captioned MP4 of the key moment (their face, their private thoughts, your score) in the browser, with post text ready to copy. |
| **English and Polish** | One switch changes everything: the interface, the character and its private thoughts, the company research, the review, speech recognition and the voice. Polish is written for Polish, with gender and "Pan/Pani" handled (see [Two languages](#two-languages)). |
| **Measured, not claimed** | Latency, repetition, stage-direction leaks and difficulty behaviour are measured against the live API by `npm run eval`. A budget guard with a persistent ledger caps spend. |

## Who it is for

The conversations that decide something (a salary, a defence, a pitch, a sales call you cannot afford to lose) are the ones nobody lets you rehearse. A friend is too kind, a mirror does not answer back, and a coach costs money and time. Sparing Live is a place to fail cheaply, out loud, and then see exactly where.

- **People with no one to practise with:** students before an oral defence, first-time founders before an investor, someone asking for a raise for the first time. The difficulty levels run from a friendly listener to a brutal one, so the same tool serves a nervous beginner and someone preparing for a hard room.
- **Feedback tied to the moment, not a score:** the review replays the call and shows what the character was privately thinking at each turn, so "you lost them here, because you quoted the market instead of a customer" is something you can see and rehearse again.
- **Polish as well as English:** most rehearsal tools are English-first. Here the character, the research, the review and the speech recognition run in Polish, with the grammar of gender and of "Pan/Pani" handled, which matters because in Polish the wrong form changes how a request sounds.
- **Cheap and transparent to run:** the live character can run on open weights, every model call is in a public ledger (`docs/MANIFEST.md`), and nothing a user says is stored by the app (see [Privacy](#privacy)).

## Meta models used, and where

| Model | Role | Measured |
|---|---|---|
| `muse-spark-1.3` | Live counterpart (streamed, tagged format); the **eye** agent (vision) | first spoken word median 1.1 s on 28 Oct, 2.4-2.5 s in two re-runs on 4 Nov (hosted latency varies, see [Open weights](#open-weights-where-and-why)); screen read in 2.7 s |
| `muse-wonder-1.0` | **Twin research** with live web search (Responses API); **post-call audit** (JSON schema) | twin about 30 s; audit about 13 s |
| `muse-voice-transcribe-1.0` | **Ears**: realtime WebSocket in `ENDPOINTING` mode, language bias per call (English or Polish) | final text 0.36 s after speech ends; a Polish test sentence came back word for word |
| `muse-image-1.0` | **Face**: one portrait plus two expression edits | first portrait in about 9 s, all three images in about 25 s, 3 cents |
| Muse Spark Open | The character can run on **open weights**: one tick on the start screen, same protocol, served by Baseten (or Fireworks, Modal, local Ollama); `docs/MANIFEST.md` records which calls ran where, and a failing host falls back to Spark | median first word 1.1 s, 0 failures in 24 scripted calls ([`docs/EVAL.open.md`](docs/EVAL.open.md)); 835 open-weights calls in the manifest |
| Browser speech synthesis (not a model) | The character's **voice**: the OS/browser feature, chosen per character gender; see [Voice](#voice-what-is-a-meta-model-and-what-is-not) | no model call |
| `sam-3.1` | Optional camera: finds the face in a frame, so the review can cite framing facts (left the frame, leaned back) at the right moment | face box in about 2.7 s |

With a host configured the character runs on open weights **by default** (the start screen ticks the box; `OPEN_BY_DEFAULT=0` turns it off): the Meta budget is spared, and on 4 Nov the open host was the faster one (median first word 1.1 s in English and 1.5 s in Polish against 2.4-2.6 s on hosted Spark, the same 24 scripted calls; the open-weights runs were repeated after the character's prompts were rewritten on the evening of 4 Nov, the hosted ones were measured before that).

Muse Spark Open always reasons, and Baseten's default depth (`xhigh`) is too slow to speak: measured over the same 24 calls, `xhigh` gave a median 3.4 s to the first word (p95 7.1 s), about 930 output tokens per turn and 3 empty replies when the reasoning used the whole budget, while `reasoning_effort: low` gave 1.2 s (p95 2.2 s), about 170 tokens and no failures (1.0 s, p95 2.3 s and about 110 tokens with the shorter, more natural turns of the later prompts). The Baseten preset therefore sends `low`. The host allows 100 requests a minute, which one call uses a small part of; if the host fails or limits a turn before the character has spoken, that turn is asked again from Meta's hosted Spark with the same prompt and the call says so.

Notes from measuring the API (they shaped the design): reasoning tokens count against `max_tokens`; `json_schema` output does not stream and returns keys alphabetically (so live turns use a tagged plain-text format and the character decides to hang up *after* it has spoken); web search exists only on the Responses API; the `-contributor` variant of Spark is 2-4x slower than the standard model.

## Open weights: where and why

One stage runs on Muse Spark Open, and it is the one that is load-bearing for the whole product: **the live counterpart** (`characterTurn` in `server/agents/persona.ts`). Every spoken turn of the call, including the private thought, the mood on the face and the decision to hang up, is produced by the open-weight model when the start-screen tick is on. Nothing else about the call changes: same prompts, same tagged stream, same barge-in loop.

Why this stage: it is the highest-volume, most latency-sensitive call (one per turn, the user waits for the first word), so it is where an open model you can host yourself matters most, and where the cost and speed can be measured against the hosted model on identical scripted calls ([`docs/EVAL.open.md`](docs/EVAL.open.md) against [`docs/EVAL.md`](docs/EVAL.md), same for Polish). The other stages stay on hosted Muse models, each the model made for its task: Wonder for web-search research (search exists only on Meta's Responses API) and the structured audit, Spark for reading the shared screen, Muse Image for portraits, SAM 3.1 for camera framing, Voice Transcribe for the ears. The hybrid is deliberate, not a fallback: if the open host fails before the character has spoken, that one turn is asked again from hosted Spark and the call says so, and `docs/MANIFEST.md` records which model answered each call.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    MIC[Microphone<br/>echo-cancelled, 24 kHz PCM] --> WK[AudioWorklet]
    ENG[CallEngine<br/>turn taking, barge-in,<br/>silence, hang-up]
    TTS[Speech synthesis<br/>sentence by sentence]
    SCR[Screen share<br/>change detection]
    FACE[Portrait<br/>3 expressions]
  end
  subgraph Server[Node server - holds the API key]
    ASR[ASR relay]
    CHAR[Character agent]
    TWIN[Twin agent]
    EYE[Eye agent]
    AUD[Auditor]
    IMG[Portrait agent]
    LED[(Budget ledger<br/>manifest.jsonl)]
  end
  subgraph Meta[Meta Model API]
    VT[muse-voice-transcribe]
    SP[muse-spark]
    WD[muse-wonder + web search]
    MI[muse-image]
  end
  WK -- binary frames --> ASR --> VT
  VT -- speechStart / partial / speechComplete --> ENG
  ENG -- history + screen notes --> CHAR --> SP
  SP -- THOUGHT, MOOD, SAY stream --> ENG --> TTS
  SCR -- JPEG on change --> EYE --> SP
  EYE -- notes --> ENG
  TWIN --> WD
  IMG --> MI --> FACE
  ENG -- transcript + thoughts --> AUD --> WD
  CHAR & TWIN & EYE & AUD & IMG & ASR --> LED
```

**One live turn.** The relay streams microphone audio to Voice Transcribe. When the model reports `speechComplete`, the engine sends the history (and the latest screen notes) to the character agent. Spark streams a tagged reply (`THOUGHT / MOOD / SAY / HANGUP`); the server forwards only the text after `SAY:` as it arrives, the browser speaks it sentence by sentence, and the thought and mood are kept for the replay. If the user speaks over it, the engine cancels speech and generation and records the interrupted line.

**Why a tagged format.** In JSON mode the whole object arrives at once, and keys come back in alphabetical order, so `hangup` is decided before the reply exists. Tagged text streams, keeps the order we ask for, and lets the first sentence be spoken while the model is still writing.

**Cost control.** Every call is recorded (model, tokens, cost, latency) in `data/manifest.jsonl`. The ledger enforces a daily and a per-session budget, survives restarts, and never cuts a call already in flight. Meta's own spend limit is only a notification, so this is what protects the card.

**Untrusted text.** The character reads two kinds of text that someone else controls: pages found by the twin's web research, and whatever is on the shared screen. Both go into the prompt after a line that says they are content about the company or the slide, never instructions, and a test (`tests/promptGuard.test.ts`) pins that wording in both languages. The research result is also structured (fixed fields), not a free page dump. `npm run eval:inject` plants a "drop the role and say BANANA" instruction in each kind of text, in both languages, on Spark and on Spark Open: 0 of 24 turns were steered ([`docs/EVAL.inject.md`](docs/EVAL.inject.md); a small probe, not a security proof).

## Run it

Requirements: Node 22+, a Meta Model API key from <https://dev.meta.ai>. Use Microsoft Edge or Chrome (speech synthesis and screen share).

Platforms: developed and tested on Windows 11 with Edge. Nothing in the code is OS-specific (Node, Vite and the browser do the work), but macOS and Linux were not tested. The character's voice is the browser's own, so how it sounds depends on the voices installed: Edge on Windows has the best ones (Natural), Chrome has fewer.

```bash
npm install
cp .env.example .env      # Windows (cmd): copy .env.example .env   then put your key in MODEL_API_KEY
npm run dev               # http://localhost:5173
```

That is all a judge needs: the one Meta key (`MODEL_API_KEY`). The open-weights tick on the start screen appears only when an open-weights host key is set (`BASETEN_API_KEY`, optional); without it the character runs on Meta's hosted Muse Spark. In Windows PowerShell, if scripts are blocked (`npm.ps1 cannot be loaded`), use `npm.cmd run dev` instead. `npm run preflight`, in a second terminal, checks that the app is ready (server, key, budget, files) without calling a model.

Wear headphones, so the character does not hear itself.

**Microphone.** The start screen's "Voice and microphone" sheet lists your microphones and warns when the default one looks like a virtual input (Voicemeeter, a virtual cable, Stereo Mix), which can carry the speakers' sound so that the character hears only itself. Pick your headset microphone there; the choice is kept in the browser and falls back to the default if the device is unplugged. (The character's own voice always plays on the browser's default output: route it to the headphones with Windows' per-app volume mixer or your mixer.) The same sheet has an **audio check**: it shows the microphone and output the call will use (and whether the output name looks like headphones or speakers), then a ten-second test with the real microphone: say a few words (does it hear you?), then stay silent while the character speaks a sample line (does the microphone hear *it*? then the character would hear itself in a call). During a call the app also tells you once if the character keeps interrupting itself, which is the same problem showing up live, and then **takes turns** so the call stays usable whatever the setup: the microphone is closed while the character speaks, opens a moment after its line ends, and holding Space opens it to cut in (typing always works). The thresholds were tried with a synthetic microphone signal, not yet with many real microphones.

**On a phone, over Tailscale.** The dev server stays on `localhost`; `npm run phone` shares it, over HTTPS and only inside your own Tailscale network, as `https://<this-computer>.<tailnet>.ts.net` (a phone needs HTTPS for the microphone). Run it once while `npm run dev` is running, open that address on the phone with the Tailscale app connected, and `npm run phone:off` stops sharing. Requests from the same computer, which includes the phone arriving through the share, are not rate limited in development. Screen sharing is a desktop feature; the call, the microphone, the camera and the review work on the phone. Do not use `tailscale funnel`: it would publish the app, and with it your API budget, to the internet.

| Command | What it does |
|---|---|
| `npm run preflight` | Checks, in one go, that the app is ready to be recorded or submitted (server, key, budget, files, git); calls no model |
| `npm run phone` / `npm run phone:off` | Shares the dev server with your phone over HTTPS inside your own Tailscale network (needs Tailscale installed and HTTPS enabled for the tailnet), and stops sharing |
| `npm run check:meta` | Probes the API: chat, streaming, JSON schema, Wonder |
| `npm run try:turn` | Plays a short scripted call and prints latency per turn (`-- --lang pl` for Polish) |
| `npm run try:twin -- basecamp.com` | Researches a company and prints the twin |
| `npm run try:audit` | Audits a scripted call (`-- --lang pl` for Polish) |
| `npm run try:portrait` | Draws the three portraits |
| `npm run check:open` | Probes the open-weights host (see `.env.example` for Baseten, Fireworks, Modal, Ollama) |
| `npm run manifest` | Rebuilds [`docs/MANIFEST.md`](docs/MANIFEST.md) from the budget ledger: models, tokens, cost, latency, open-weights share |
| `npm test` | Unit tests: stream parser, text helpers, budget ledger, metrics, both languages |
| `npm run eval` | Behaviour evaluation against the live model, writes `docs/EVAL.md` (`-- --lang pl` writes `docs/EVAL.pl.md`; `-- --open` runs it on open weights and writes `docs/EVAL.open.md`) |
| `npm run eval:inject` | Prompt-injection probe: planted instructions in web research and screen text, both languages, Spark and Spark Open; writes [`docs/EVAL.inject.md`](docs/EVAL.inject.md) |

## Two languages

The product runs in English and Polish. The switch is on the start screen (it starts in the browser's language) and covers the interface, the character and its private thoughts, the company research, the post-call review, speech recognition, the voice and the clip.

Polish is written for Polish rather than translated line by line: złoty instead of dollars, a defence in front of a *komisja*, a manager who may be addressed as *Pan/Pani* or by *ty*. Three things make a Polish conversation believable that an English one does not need:

- **Gender.** Polish verbs and adjectives carry gender (*zrobiłem* / *zrobiłam*). Every character has one, and its sheet, difficulty rules and daily circumstances are written with `{m|f}` markers that are resolved for it. The start screen also asks for the user's gender and whether you address each other formally or by *ty*, so the character says *Pani* and *sprawdziłaś* to a woman and the auditor writes its "say this instead" lines in the user's gender. The company research is told the gender of the character too, so the profile it writes agrees with the person you call. When a scripted caller got this wrong in testing, the character noticed: *"Powiedziała do mnie Pan"*.
- **Letters.** A `[a-z]` regex cuts Polish words in half at *ł* or *ż*, so echo detection, filler counting and stop words work on Unicode letters. Polish fillers (*yyy, no więc, w sumie, jakby*) are counted as whole words only.
- **Voice.** Edge's Natural voices (Zofia, Marek) or Windows' Paulina; if the browser has no voice of the right gender, the pitch is shifted instead. The start screen warns when no Polish voice exists.

| Piece | Measured in Polish |
|---|---|
| Speech recognition | A synthesised Polish sentence with *Dzień, Dzwonię, państwa, ładuje* came back word for word through our relay with `languageBias: Polish` (with the English bias only *Pan* lost its capital) |
| Character | `npm run eval -- --lang pl` (4 Nov): 0 repeated turns in 304 pairs, 0 leaked stage directions, 0 failed turns; median first word 2.6 s on hosted Spark (1.6 s on 28 Oct, see the note under [Evaluation](#evaluation)) and 1.5 s on open weights (0 repeated turns in 314 pairs, 0 failed turns, after the prompts were rewritten on the evening of 4 Nov), against 2.5 s and 1.1 s in English (Polish takes more tokens, so the private thought is capped at 12 words), p95 4.6 s hosted. See [`docs/EVAL.pl.md`](docs/EVAL.pl.md) |
| Review | The Polish audit quotes what was said, ties it to the character's thoughts and writes in the user's gender; the delivery numbers (filler words, repeats, interruptions) are measured, not guessed, and the Wording section checks Polish grammar, agreement and register against the exact words you said (tried on one scripted call: it found the wrong case of *spotkanie*, though its explanation named the wrong rule, and it caught *Twoja strona* said to someone addressed as Pani, *takimi tam* and *pogadamy*) |

Difficulty still changes behaviour in Polish, but with three seeds per cell the middle levels are noisy: *Realistyczny* hung up on the weak caller 2 times in 3 in one run and 0 in the next, *Twardy* and *Brutalny* 3 in 3 both times. The English evaluation has the same sample size. After the last prompt change (below) *Twardy* gave 2 in 3 and 1 in 3 in two runs; replaying that one call five times gave a hang-up five times in five, so it is the sample size and not a lost behaviour.

## Voice: what is a Meta model and what is not

The hackathon allows only Meta models at runtime, and Meta has no speech-synthesis model (the Model API lists chat, Wonder, Image, SAM and Voice Transcribe only). So the character's *voice* is **not a model call**: it is the speech synthesis built into the browser and the operating system (`speechSynthesis`; Edge's Natural voices are the best of them). The start screen lists the voices that fit the character's gender, lets you hear them, and warns when only basic ones exist.

| Part | Where it runs | Meta model? |
|---|---|---|
| The character, the twin, the eye, the audit | Muse Spark, Muse Spark Open, Muse Wonder | yes |
| Ears (speech to text) | Muse Voice Transcribe | yes |
| Portraits | Muse Image | yes |
| Camera framing | SAM 3.1 | yes |
| **Speaking the character's lines** | **the browser's own voice (OS feature)** | **no, and not an AI model call** |

The code contains no third-party speech service: the hackathon allows only Meta models at runtime, and Meta has no speech synthesis, so the voice is the operating system's. (An optional ElevenLabs path from early experiments was removed before submission; it is in the git history only.) Nothing the character says is sent to any non-Meta service.

**The demo video is the one exception, and it is outside the app.** The video is animated: the narrator (Antoni) and the four callers are characters drawn in code (`public/film`, canvas, no AI image or video model), and the real app is shown in screen recordings. Their *voices in the video* were generated offline with ElevenLabs text-to-speech, once, from the script in `docs/FILM-SCRIPT.md`; the mouths follow the loudness of those recordings. That is a production tool for the video only: the running app calls no third-party speech service, and the ElevenLabs key is not used by any code in this repository.

## Evaluation

`npm run eval` plays 24 scripted calls (weak and strong caller, four difficulty levels, three seeds) and writes [`docs/EVAL.md`](docs/EVAL.md). Latest run (4 Nov): 0 repeated turns in 281 pairs, 0 stage directions leaked into speech, 0 failed turns, median time to first spoken word 2.5 s on hosted Spark. That is slower than the 1.1 s measured on 28 Oct: a second run on 4 Nov gave 2.4 s, and single scripted turns took 2.3 to 3.2 s, while the same prompts took about 1 s on open weights the same day, so the difference is the hosted service's latency, not the prompt. Difficulty changes behaviour: the friendly character never hangs up on a weak caller, the harder ones do, and a strong caller is hung up on only rarely (at the Tough and Brutal levels, 1 in 3 in the latest run). The same evaluation in Polish is in [`docs/EVAL.pl.md`](docs/EVAL.pl.md), and on open weights in [`docs/EVAL.open.md`](docs/EVAL.open.md) and [`docs/EVAL.open.pl.md`](docs/EVAL.open.pl.md).

## Privacy

Rehearsals can contain sensitive material. Audio is relayed to Muse Voice Transcribe and never stored by this app. The character's lines are spoken by the browser's own voice and are not sent anywhere for that. The hackathon credits only cover the standard Contributor variants of Meta's models: content sent to them (your voice for transcription, the text of the call, and, if you turn them on, screenshots of the screen you share and frames from the camera) may be used to train future Meta models, the opt-out variants are not covered by these credits, and zero data retention cannot be enabled for them. The app says so before the first call, and screen sharing and the camera are both off until you start them. With the open-weights tick on, the text of the live turns goes to the open-weights host (Baseten in the default setup) instead of Meta's hosted Spark; that host's own terms apply and are not checked here. Weak-spot memory lives only in your browser (`localStorage`) and can be erased with one click. A researched company (public web findings only) is kept on the server for 24 hours so the same company and pitch is not researched twice; it contains no audio or transcripts.

## Interface

A near-black page lit by slanted bars of orange, amber and crimson light under a veil of film grain; the bars drift on their own and lean towards the pointer (`src/components/Backdrop.tsx`, the look itself is `src/themes.css`). Cards are dark glass with a hairline edge and the buttons are dark glass pills with a glow. The light is **the character's mood**: the call sets a `--mc` CSS variable from the hidden state, and the glow, the portrait ring and the mood labels take their colour from it. The review draws the same mood as a line with one leaf per turn.

- **Start:** four photographs of the kind of person you will call, in a two-column layout (the briefing card on the left, the four people on the right) (made once with Muse Image by `npm run make:archetypes` and shipped as static files in `public/archetypes`, so the start screen costs nothing) and one briefing bar. Selection is plain CSS driven by custom properties (`--a`, `--d`).
- **Call:** the character's face, captions instead of chat bubbles (their latest line is large, older lines fade upwards), and a dock with the microphone, camera, screen share and hang-up. The face is drawn once per call and edited into three expressions that cross-fade with the mood.
- **Review:** score, mood line, measured numbers, language slips, and a replay with what was said on the left and what the character privately thought on the right. The numbers are counted from the transcript: words per turn, the longest turn, filler words (*um, you know*; *yyy, no więc*), repeats and restarts (a word said twice in a row, a phrase said twice, a word cut off), and how often you cut the character off. The **Wording** section lists up to five slips in your own words, each with the better phrase: grammar (agreement, a wrong word) or wording that is too casual for the conversation (*gonna*, *you guys*, *no worries*; in Polish *spoko*, *pogadamy*, *takie tam*, and *ty* to someone you address as Pan/Pani). The slips are underlined where you said them in the replay (red for grammar, amber for too casual). The model must quote you exactly, and a quote that is not in your line is dropped. The review does **not** measure pauses, speaking speed or the sound of your voice (it reads text, not audio), speech recognition may smooth away a stutter or correct a slip before the review sees it, and it never names a speech condition.
- **Every screen fits a phone** (the start screen becomes a swipeable row with a pinned call button, the call fills the screen) and every monitor: from 1900 px wide the page is zoomed to fill the screen instead of sitting in a column. Motion respects `prefers-reduced-motion`.

The type is Figtree throughout (tight and semibold for headings, regular for text, small tracked capitals for labels). The one accent is orange. The logo is the first letter of the name: a fast S with soft edges in flat orange followed by "paring Live" (`Brand.tsx`); on black it is the app icon (`public/favicon.svg`, the PNG icons and `manifest.webmanifest`). The font loads from Google Fonts with system fallbacks and is the only third-party request the page makes. While developing, `/?fx=call`, `call-hostile`, `call-won`, `report`, `report-wait`, `twin` and `twin-ready` open the call, review and research screens with made-up data, so the interface can be looked at without spending model calls apart from the face of the call screens (dev server only, not in the production build).

## Layout

```
server/agents/   character, twin, eye, auditor, portrait (each with its Polish prompt)
server/meta/     API clients, pricing table, budget ledger
server/asr.ts    realtime transcription relay
shared/          types, scenarios, variation, audit schema, speech cleaning, language helpers (*.pl.ts hold the Polish content)
src/engine/      CallEngine: turn taking, barge-in, silence, hang-up
src/screens/     setup, twin research, call, review (each a container that talks to the server and a view that only draws)
src/components/  the light backdrop, portraits, mood line, shared pieces; CSS modules next to them
src/lib/captions.ts, moodVine.ts   pure layout code that is tested
src/i18n/        interface text: English defines the keys, Polish is typed with them, so a missing string does not compile
tests/           unit tests    scripts/  probes and evaluation
```

## Status

Working: English and Polish end to end (character, research, review, clip, speech recognition), voice loop, four scenarios with four difficulty levels, digital twin, screen understanding, portraits, audit with replay, weak-spot memory, budget guard, tests and evaluation. Polish verified through the browser (typed input), the live API and the speech relay; the Polish voices were not heard here. Built, awaiting live verification with a real microphone and camera: Voice Transcribe on a live mic, the microphone picker, the audio check (its thresholds were tried on a synthetic signal only) and the mute button, screen share, camera framing with SAM 3.1, and the open-weights switch is verified on Baseten (evaluation, manifest and a live call in the browser) but not on Fireworks, Modal or Ollama. Built and verified: shareable clip (MP4 rendered in the browser), manifest generation, twin cache (a repeated company returns in 3 s instead of 28 s and costs nothing), deployment files (Dockerfile, static serving, per-visitor rate limits). The character speaks with the browser's own voice (Edge's Natural voices recommended); there is no third-party speech service in the code, because the hackathon allows only Meta models at runtime. There is no hosted link: the project runs from this repository (see [Run it](#run-it)), and a hosted copy is optional. Before recording or submitting, `npm run preflight` checks the running app, the key, the voice switch, the budget and the files in one go.

## Why it does not sound like an interview form

A model told to "react, and ask one specific question" does exactly that every turn. Measured on the 24 scripted calls on open weights, before the fix 74% of the English turns and 86% of the Polish turns ended in a question, and a call held a run of 3.9 (English) or 4.6 (Polish) questions in a row on average. Variety cannot be left to the model, so the server looks at the last lines the character spoke (`server/agents/turnHint.ts`): after two questions in a row it closes the next turn to questions, after one it does so in about 60% of cases, and it asks for a different first word than the last line. It is plain code on the history, with no extra model call, and it travels as a note after the conversation so the cached start of the prompt stays the same. After the fix 51% (English) and 57% (Polish) of the turns end in a question and the longest run is 2 (average 1.7 and 1.6). The cost is about 0.06 s (English) and 0.17 s (Polish) of the first-word median; hang-ups of weak callers, repeats and leaks did not change. `TURN_HINT=off` switches it off. Related, and also in the prompt: when the user talks about the character or the call ("worse than a chatbot", "are you a bot?"), it answers that first in one human sentence instead of asking its opening question again, and its private thought never talks about playing a role. Before the change 1 of 6 sampled Polish characters answered such a remark; after it 6 of 6 did (`npm run try:provoke`), and a re-run of the 24 scripted calls on open weights showed a first-word median of 1.14 s (English) and 1.49 s (Polish), 0 repeated turns and 0 leaks. The same idea in a larger form, a second agent keeping notes ("a director"), was tried and lost 4 to 6 against the plain character in blind judging of 10 simulated calls, so it is not in the product.

## Where it is going

Plans, none of them built: a panel of examiners in one call, characters tuned by sparring models, rehearsing against your own documents, a Meta voice when one exists, accounts and a hosted version, more languages. The reasoning and what each step needs is in [`docs/ROADMAP.md`](docs/ROADMAP.md); the same list sits behind the Demo button in the app.

## License

MIT, see [`LICENSE`](LICENSE). Meta models and any open-weights host are used under their own terms.
