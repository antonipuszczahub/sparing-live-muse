# Posts to copy (nothing here is sent by the app)

Most Viral counts interactions on the X post until 8 Nov end of day, so post early, with the clip. Community Vote opens 9 Nov: a post in the hackathon Discord (#build-for-your-world) brings votes. Tag the hackathon and Meta accounts yourself, I do not know their exact handles.

**Pictures:** `docs/img/social.png` (1280x640) is the card for the post and for the repository: on GitHub, Settings, General, Social preview, Upload an image, so that a pasted repository link shows it. `docs/social/card.html` is its source.

Every number below is measured and in the README or `docs/MANIFEST.md`. Change a number only if you re-measure it.

## X, English (one post, attach the clip from the review screen)

> I built a voice sparring partner on Meta's Muse models.
>
> You call a skeptical investor, a thesis examiner, your boss or a buyer. They interrupt you. They read your shared screen. Their face changes with their mood. And afterwards you see what they were privately thinking, turn by turn.
>
> The live character runs on Muse Spark Open. [clip] [repo]

(about 380 characters: X allows 280 for a free account. Use the short version if so.)

### Short version (under 280)

> A voice sparring partner on Meta's Muse models: call an investor, an examiner or your boss. They interrupt you, read your screen, and afterwards show what they were privately thinking. Runs on Muse Spark Open. [clip] [repo]

## X thread (3 more posts under the first)

1. **How it works:** "Full duplex voice: you can talk over the character and it stops mid-sentence. Ears: Muse Voice Transcribe. Character: Muse Spark Open on Baseten (hosted Spark as fallback). Research on a real company: Muse Wonder with live web search. Face: Muse Image. Review: Wonder."
2. **Measured, not claimed:** "First spoken word: median 1.0 s in English and 1.3 s in Polish on open weights, against 2.5 s and 2.6 s on hosted Spark (measured earlier the same day). 0 failed turns in 24 scripted calls per language. `npm run eval` reproduces it. Every model call is in a public ledger: 1,967 calls so far, 835 of them on open weights."
3. **Try it:** "Open source, MIT. English and Polish (gender and Pan/Pani handled). Runs from the repo with your own Meta key: [repo]"

## X, Polish

> Zbudowałem głosowego partnera do sparingu na modelach Meta Muse. Dzwonisz do inwestora, egzaminatora albo szefa. Przerywa Ci, czyta Twój ekran, a po rozmowie pokazuje, co naprawdę myślał. Działa na Muse Spark Open, po polsku i po angielsku. [klip] [repo]

## Discord (#build-for-your-world), in English

> **Sparing Live: rehearse the conversation you are afraid of**
> Voice sparring on Muse. You call an investor, an examiner, a boss or a buyer; they interrupt you, read your shared screen, show their mood on a face, can hang up, and afterwards the review replays the call with what they were privately thinking.
> What is under it: full-duplex voice loop with barge-in, specialised agents with hidden state, the character on Muse Spark Open (Baseten) with Spark as fallback, research with Wonder, faces with Muse Image, ears with Voice Transcribe. English and Polish.
> Measured: English median first word 1.0 s (open weights) / 2.5 s (hosted Spark, measured earlier the same day), Polish 1.3 s / 2.6 s; 0 failed turns in 24 scripted calls per language; ledger of every call in `docs/MANIFEST.md`.
> Repo: [link] · Demo video: [link]. Feedback welcome, especially on the Polish.

(Post it yourself: the Discord rule is to click and type only in a new message, never inside an open thread. Do not post keys or cards.)
