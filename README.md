# Sparing Live

Real-time voice sparring for high-stakes conversations, built on Meta's Muse models for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026).

You call an AI counterpart (a skeptical client, a tough thesis examiner, a company's digital twin researched live from the web). It listens, thinks, interrupts, sees your screen, and can hang up on you. Afterwards a multi-agent audit shows exactly where you lost them and what you should have said.

> All code in this repository was written during the hackathon. An earlier Polish prototype (local LLM) existed before; this is a from-scratch rebuild on the Meta Model API.

## Meta models used

| Model | Role |
|---|---|
| `muse-spark-1.3` | Live counterpart: hidden thoughts, mood, reply, hang-up decision; screen understanding |
| `muse-wonder-1.0` | Company digital-twin research (web search), post-call audit |
| `muse-voice-transcribe-1.0` | Realtime speech recognition with timestamps |
| `sam-3.1` | Camera moments (gaze, face in frame, hands) |
| `muse-image-1.0` | Counterpart portraits and emotion variants |
| Muse Spark Open (Baseten) | Open-weight provider for the counterpart |

## Status

Work in progress — see commit history.
