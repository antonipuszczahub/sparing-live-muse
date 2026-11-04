# Where Sparing Live is going

None of this is built yet. It is what the current design was made to allow, in the order I would do it, and what each step would need from Meta's models. The same list is in the app, behind the Demo button.

## 1. A panel, not one person

A thesis committee or an investment committee: three or four characters in one call, each with their own agenda and voice, who also talk over each other. The turn-taking loop already handles one counterpart interrupting the user; the new part is a conductor that decides who speaks next and lets a second character cut in on the first. Each character is one Muse Spark Open call with its own private state, so the cost grows with the panel, and the measured first-word latency (about 1.2 s on open weights) is the budget the conductor has to live inside.

## 2. Characters that tune themselves

Two models sparring with each other to sharpen a character, judged by the evaluation that already exists (`npm run eval`: first-word time, repeated turns, leaked stage directions, whether difficulty changes behaviour). Open weights make this possible: the character model can be fine-tuned on a host, not only prompted. The injection probe (`npm run eval:inject`) would become part of the same gate.

## 3. Your own material

Paste a job description, a contract or your deck and rehearse against what is actually in it. The shared-screen reader (Muse Spark vision) already turns a slide into notes the character reacts to; the next step is to read a document once and keep its claims as the character's private knowledge, labelled as content and never as instructions (the same framing the web research already gets).

## 4. A voice from Meta

Today the voice is the browser's own speech synthesis, because the hackathon allows only Meta models at runtime and Meta has no speech-synthesis model in its API. When one exists, the character speaks with it; the call engine already treats the speaker as a replaceable part. Meta's open MMS text-to-speech model is a possible interim step if its non-commercial licence fits.

## 5. Your progress, everywhere

Accounts and a hosted version, so your weak spots and scores (today kept only in one browser) follow you to your phone, and a coach or a class can set scenarios for a group and see where the group loses people. The phone already works against a local copy over Tailscale; hosting adds the sign-in, the per-visitor budget and the data policy that goes with storing anything.

## 6. More languages

English and Polish are complete end to end. A language is a bounded piece of work (`Lang`, the scenario and variation pools, the character, twin, eye and auditor prompts, a typed dictionary, speech recognition language bias, voice names, tests, `eval --lang`), and Polish was added in this way, with grammatical gender and a formal register, which is the hard case.

## What would change my mind

If real users in the demo keep ignoring the review and only redialling, the product is a drill and the review should be shorter and sharper. If the open-weights host stays faster than the hosted model, the hosted model becomes the fallback only. If speakers cause more trouble than headphones solve, the next step is not a better filter but a push-to-talk mode.
