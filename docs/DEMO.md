# Demo script (3 minutes)

The submission form takes a link to a video of at most 3:00 (judges stop at 3:00). Say in the first line what existed before and what was built this week.

## Before recording

- Headphones on, so the character does not hear itself. Microsoft Edge, English UI (the switch is top right), microphone allowed for `localhost`.
- `npm run dev` (in PowerShell: `npm.cmd run dev`, because PowerShell blocks `npm.ps1`), then in a second tab `npm run preflight`: it must say READY. It checks the server, the key, that no third-party voice is on, the budget and the files, and calls no model. Start screen: open weights ticked (it says "Open weights · Baseten"), `THIRD_PARTY_VOICE` **not** set (an ElevenLabs key left in `.env.local` is ignored without it, and `preflight` checks this).
- Run the company research once beforehand (type the company on the start screen, wait for it to finish). The result is cached for 24 hours, so on camera it returns in seconds.
- Have a window open with one weak slide (a claim without a source, such as "94% of clinics lose visits") for the screen share: `docs/demo-slide.html` is ready (open it in a browser window, F11).
- Budget line on the start screen should show room for the day. Do a dry run first: one real call costs a few cents.
- `npm run manifest` before the final cut, so the numbers you quote match `docs/MANIFEST.md` (last run 4 Nov: 1,574 calls, 835 of them on open weights).

## Shot list

| Time | On screen | Say |
|---|---|---|
| 0:00 | Start screen | "Before this week I had a Polish prototype on a local model. Everything you see here was built this week on Meta's Muse models: a voice loop, a set of agents, and a reviewer." |
| 0:12 | Press "Demo setup" (it picks the investor, the Realistic level and a ready pitch), type the real company, press Call. The research steps scroll | "I'm calling an investor at a real company. Muse Wonder researched it with live web search, so she knows what the company knows." |
| 0:30 | The call. Speak a pitch, let her interrupt once, then talk over her | "Full duplex: she can cut me off, and when I talk over her she stops mid-sentence. The face is Muse Image; the ring around it and the glow behind the page are her mood." |
| 1:00 | Share the screen, show the weak slide | "She can see my screen. Muse Spark reads the slide and she goes straight for the claim with no source." |
| 1:25 | Keep talking until the mood turns, or hang up yourself | "Her mood moves with what I say. Hard levels hang up on a weak pitch." |
| 1:45 | Review: score, mood vine, the replay with private thoughts | "Afterwards the reviewer shows what she was privately thinking at each turn, and the exact sentence where I lost her." |
| 2:20 | Open the README table or `docs/MANIFEST.md` | "The live character runs on Muse Spark Open, served by Baseten. Same speed as hosted Spark: median first word 1.2 s, no failures in 24 scripted calls. Transcription is Voice Transcribe, research and the audit are Wonder, the face is Muse Image, and every call is in the budget ledger." |
| 2:45 | Flip to Polish, one line of a call, then the clip button | "One switch and it is Polish, with gender and formal address handled. And it renders a clip of the moment you lost them." |

## A script for your side of the call

After "Demo setup" the pitch is an app that fills the empty appointment slots of dental clinics. These lines give the call a clear arc (cold, a moment she warms up, a mistake, a recovery) without sounding rehearsed. Say them in your own words; the character reacts to what you actually say.

1. **Open.** "Hi, I'm [name]. We fill the empty appointment slots of dental clinics, and two clinics already pay us eight hundred a month."
2. **Let her cut in** with her first question, then answer it in one sentence. This is the "full duplex" moment: stop talking the instant she speaks, and once, on purpose, talk over her mid-sentence.
3. **Share the screen** and open `docs/demo-slide.html` in its own window (press F11 first). It is one slide with a bold claim and no source: "94% of clinics lose visits", "Market: $40B". Say: "Here is the slide." She should go for the missing source within a turn or two.
4. **The mistake.** Answer her with the market size instead of a customer: "The market is about forty billion, and we are just getting started." Her mood should drop; this is the sentence the review will point to.
5. **The recovery.** "Fair. Two clinics pay eight hundred a month each, both renewed once, and a third signs next month." Her mood should rise.
6. **Close** with a clear ask: "Can we take twenty minutes on Thursday so I can show you the renewal numbers?" Then hang up yourself, or keep going until she does.

Record a dry run first: the model answers differently each time, so the exact words will not repeat. If a take goes flat, start again; one call costs a few cents.

## Cut if it runs long

The camera and SAM are not in the shot list. Drop the Polish switch before dropping the review or the open-weights line: those two carry the score.

## Post for X (post early; interactions count until 8 Nov)

> I built a voice sparring partner on Meta's Muse models. You call a buyer, an examiner, your boss or an investor. It interrupts you, reads your screen, shows its mood on its face, can hang up, and afterwards shows what it was privately thinking. Runs on Muse Spark Open. [video] [repo]

Link the repo (and a hosted link only if one exists: hosting is optional for judges).
