import { langOf } from '../../shared/lang.ts';
import { simNote } from '../../shared/notes.ts';
import type { BotReply, Lang, Mood, SessionConfig, Turn } from '../../shared/types.ts';
import { cleanSpeech } from '../../shared/speech.ts';
import { translate } from '../i18n/index.ts';
import { postSSE } from '../lib/sse.ts';
import { MetaEars, type EarsLike } from '../lib/metaEars.ts';
import { Ears } from '../lib/stt.ts';
import { novelWords, takeSentences } from '../lib/text.ts';
import { createCloudSpeaker, resolveCloudVoice } from '../lib/cloudVoice.ts';
import { pickVoice, pitchFor, Speaker, type SpeechOut, type VoicePick } from '../lib/tts.ts';

export type CallState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

export interface CallSnapshot {
  state: CallState;
  turns: Turn[];
  /** What the character is saying right now (grows while it streams). */
  liveBot: string;
  /** What the user is saying right now (partial recognition). */
  liveUser: string;
  mood: Mood;
  elapsedMs: number;
  endReason?: 'hangup' | 'user' | 'budget' | 'error';
  error?: string;
  /** Latency of the last turn: user stopped talking -> first spoken word. */
  lastLatencyMs?: number;
}

const SILENCE_MS = 14_000;
const MIN_BARGE_WORDS = 2;

export class CallEngine {
  private turns: Turn[] = [];
  private state: CallState = 'connecting';
  private liveBot = '';
  private rawBot = '';
  private liveUser = '';
  private mood: Mood = 3;
  private startedAt = 0;
  private endReason?: CallSnapshot['endReason'];
  private error?: string;
  /** Said once when the cloud voice gives way to the browser voice. Kept apart so another error does not hide it. */
  private voiceNotice = '';
  private lastLatencyMs?: number;

  private ears: EarsLike;
  private speaker: SpeechOut;
  private abort: AbortController | null = null;
  private silenceTimer: number | undefined;
  private tick: number | undefined;
  private pendingFinal: BotReply | null = null;
  private sentenceBuf = '';
  private userStoppedAt = 0;
  private turnId = 0;
  private lang: Lang;
  /** Name of the voice the character speaks with (empty when the browser has none). */
  voiceName = '';
  private browserPick: VoicePick;

  constructor(
    private config: SessionConfig,
    private session: string,
    private onChange: (s: CallSnapshot) => void,
    private screenContext: () => string | undefined = () => undefined,
  ) {
    this.lang = langOf(config);
    // A browser may have no voice of the right gender (Windows ships a single Polish voice): shift the pitch instead.
    const pick = pickVoice(config.persona.gender, this.lang);
    this.browserPick = pick;
    this.voiceName = pick.voice?.name ?? '';
    this.speaker = this.useSpeaker(new Speaker(pick.voice, this.lang, pitchFor(pick.matched, config.persona.gender)));
    this.ears = this.wireEars(new MetaEars(session, this.lang), true);
  }

  private useSpeaker<S extends SpeechOut>(speaker: S): S {
    speaker.onIdle = () => this.onSpeechIdle();
    speaker.onStart = () => {
      if (this.userStoppedAt) this.lastLatencyMs = Date.now() - this.userStoppedAt;
      this.set('speaking');
    };
    return speaker;
  }

  /**
   * The cloud voice (ElevenLabs) when the server has one and the user has not turned it off; otherwise the
   * browser voice that is already in place. If the cloud voice fails mid-call the browser voice takes over.
   */
  private async chooseVoice() {
    const gender = this.config.persona.gender;
    const cloud = await resolveCloudVoice(this.lang, gender).catch(() => null);
    if (!cloud || this.state === 'ended') return;
    const pick = this.browserPick;
    const speaker = createCloudSpeaker(this.session, this.lang, cloud.id, { voice: pick.voice, pitch: pitchFor(pick.matched, gender) });
    speaker.onFallback = (code) => {
      this.voiceName = pick.voice?.name ?? '';
      this.voiceNotice = translate(this.lang, 'voiceFallback', code);
      this.emit();
    };
    this.speaker.dispose?.();
    this.speaker = this.useSpeaker(speaker);
    this.voiceName = `ElevenLabs · ${cloud.name}`;
  }

  /** Muse Voice Transcribe is the ears; if it cannot start, fall back to the browser's recognizer. */
  private wireEars(ears: EarsLike, canFallBack: boolean): EarsLike {
    ears.onInterim = (t) => this.onInterim(t);
    ears.onFinal = (t) => this.onFinal(t);
    ears.onError = (m, fatal) => {
      if (fatal && canFallBack && this.state !== 'ended') {
        this.ears.stop();
        this.ears = this.wireEars(new Ears(this.lang), false);
        this.ears.start();
        return;
      }
      this.error = m;
      this.emit();
    };
    return ears;
  }

  private screenNotes: string | undefined;

  /** Notes from the eye agent about the user's shared screen. Cleared with undefined when sharing stops. */
  setScreen(notes: string | undefined, first = false) {
    this.screenNotes = notes;
    // The character reacts the moment it sees something, like a person would.
    if (notes && first && this.state === 'listening') void this.botTurn(simNote('screen-shared', this.lang));
  }

  start() {
    this.startedAt = Date.now();
    this.ears.start();
    this.tick = window.setInterval(() => this.emit(), 500);
    // The first line waits for the choice of voice, which is instant once the start screen has loaded the catalog.
    void this.chooseVoice().then(() => {
      if (this.state !== 'ended') void this.botTurn();
    });
  }

  hangUp() {
    this.finish('user');
  }

  /** Text input fallback (also used by tests). */
  sendText(text: string) {
    this.onFinal(text);
  }

  get history(): Turn[] {
    return this.turns;
  }

  private now() {
    return Date.now() - this.startedAt;
  }

  private set(state: CallState) {
    if (this.state === 'ended') return;
    this.state = state;
    this.emit();
  }

  private emit() {
    this.onChange({
      state: this.state,
      turns: [...this.turns],
      liveBot: this.liveBot,
      liveUser: this.liveUser,
      mood: this.mood,
      elapsedMs: this.state === 'ended' ? this.now() : Date.now() - this.startedAt,
      endReason: this.endReason,
      error: [this.error, this.voiceNotice].filter(Boolean).join(' ') || undefined,
      lastLatencyMs: this.lastLatencyMs,
    });
  }

  // ---- hearing -----------------------------------------------------------

  private botText() {
    return this.liveBot || this.turns.findLast((t) => t.role === 'bot')?.text || '';
  }

  private onInterim(text: string) {
    if (this.state === 'ended') return;
    window.clearTimeout(this.silenceTimer);
    this.liveUser = text;
    this.emit();
    // Barge-in: the user talks over the character. Echo of the character's own voice is filtered out.
    if ((this.state === 'speaking' || this.state === 'thinking') && novelWords(text, this.botText(), this.lang).length >= MIN_BARGE_WORDS) {
      this.interruptBot();
    }
  }

  private onFinal(text: string) {
    if (this.state === 'ended') return;
    this.liveUser = '';
    if (this.state === 'speaking' && novelWords(text, this.botText(), this.lang).length < MIN_BARGE_WORDS) return; // echo
    if (this.state === 'speaking' || this.state === 'thinking') this.interruptBot();
    this.userStoppedAt = Date.now();
    this.turns.push({ role: 'user', text, at: this.now() });
    this.emit();
    void this.botTurn();
  }

  private interruptBot() {
    this.turnId++;
    this.abort?.abort();
    const spoken = this.speaker.spokenText;
    this.speaker.cancel();
    if (spoken) {
      this.turns.push({ role: 'bot', text: spoken + ' —', thought: this.pendingFinal?.thought, mood: this.mood, at: this.now() });
    }
    this.liveBot = '';
    this.rawBot = '';
    this.sentenceBuf = '';
    this.pendingFinal = null;
    this.set('listening');
  }

  // ---- the character's turn ---------------------------------------------

  private async botTurn(note?: string) {
    const id = ++this.turnId;
    this.abort?.abort();
    const ac = (this.abort = new AbortController());
    this.speaker.reset();
    this.liveBot = '';
    this.rawBot = '';
    this.sentenceBuf = '';
    this.pendingFinal = null;
    this.set('thinking');

    const history = this.turns.map((t) => ({ ...t }));
    if (note) history.push({ role: 'user', text: note, at: this.now() });

    try {
      await postSSE(
        '/api/turn',
        { session: this.session, config: this.config, history, screen: this.screenNotes ?? this.screenContext() },
        (event, data) => {
          if (id !== this.turnId) return;
          if (event === 'say') this.onSay((data as { delta: string }).delta);
          else if (event === 'final') this.onFinalReply(data as BotReply);
          else if (event === 'error') {
            const d = data as { message: string; budget?: string };
            this.error = d.message;
            this.finish(d.budget ? 'budget' : 'error');
          }
        },
        ac.signal,
      );
    } catch (e) {
      if (ac.signal.aborted || id !== this.turnId) return;
      this.error = e instanceof Error ? e.message : translate(this.lang, 'connectionLost');
      this.finish('error');
    }
  }

  private onSay(delta: string) {
    this.rawBot += delta;
    this.liveBot = cleanSpeech(this.rawBot);
    this.sentenceBuf += delta;
    const { sentences, rest } = takeSentences(this.sentenceBuf);
    this.sentenceBuf = rest;
    for (const s of sentences) {
      const spoken = cleanSpeech(s);
      if (spoken) this.speaker.say(spoken);
    }
    this.emit();
  }

  private onFinalReply(reply: BotReply) {
    this.pendingFinal = reply;
    this.mood = reply.mood;
    const tail = cleanSpeech(this.sentenceBuf).trim();
    if (tail) this.speaker.say(tail);
    this.sentenceBuf = '';
    this.liveBot = reply.reply;
    this.speaker.finish();
    this.emit();
  }

  /** The character finished speaking. */
  private onSpeechIdle() {
    const reply = this.pendingFinal;
    if (!reply || this.state === 'ended') return;
    this.pendingFinal = null;
    this.turns.push({ role: 'bot', text: reply.reply, thought: reply.thought, mood: reply.mood, at: this.now() });
    this.liveBot = '';
    if (reply.hangup) {
      this.finish('hangup');
      return;
    }
    this.set('listening');
    this.armSilence();
  }

  private armSilence() {
    window.clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => {
      if (this.state !== 'listening') return;
      void this.botTurn(simNote('silent', this.lang));
    }, SILENCE_MS);
  }

  private finish(reason: NonNullable<CallSnapshot['endReason']>) {
    if (this.state === 'ended') return;
    // Hanging up while the character is talking: keep what it was saying in the transcript.
    if (this.state === 'speaking' || this.state === 'thinking') {
      const text = this.pendingFinal?.reply ?? (this.speaker.spokenText || this.liveBot);
      if (text.trim()) {
        const cut = !this.pendingFinal && text.trim() !== this.liveBot.trim();
        this.turns.push({
          role: 'bot',
          text: text.trim() + (cut ? ' —' : ''),
          thought: this.pendingFinal?.thought,
          mood: this.mood,
          at: this.now(),
        });
      }
      this.liveBot = '';
    }
    this.turnId++;
    this.abort?.abort();
    this.speaker.cancel();
    this.speaker.dispose?.();
    this.ears.stop();
    window.clearTimeout(this.silenceTimer);
    window.clearInterval(this.tick);
    this.endReason = reason;
    this.state = 'ended';
    this.emit();
  }

  dispose() {
    this.finish(this.endReason ?? 'user');
  }
}
