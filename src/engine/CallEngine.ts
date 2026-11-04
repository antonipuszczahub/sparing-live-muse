import { langOf } from '../../shared/lang.ts';
import { simNote } from '../../shared/notes.ts';
import type { BotReply, Lang, Mood, SessionConfig, Turn } from '../../shared/types.ts';
import { cleanSpeech } from '../../shared/speech.ts';
import { translate } from '../i18n/index.ts';
import { postSSE } from '../lib/sse.ts';
import { MetaEars, type EarsLike } from '../lib/metaEars.ts';
import { Ears } from '../lib/stt.ts';
import { novelWords, takeSentences } from '../lib/text.ts';
import { afterCutIn, CUT_IN, CUT_IN_GRACE_MS, CUT_IN_PAUSE_MS, CutInGate } from './cutin.ts';
import { EchoWatch, isBotEcho, micClosedForTurnTaking, MIN_BARGE_WORDS, TURN_TAKING_TAIL_MS } from './echo.ts';
import { pickVoice, pitchFor, Speaker, type SpeechOut } from '../lib/tts.ts';

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
  /** The microphone is muted: the character does not hear the user (typing still works). */
  muted: boolean;
  /** The character was hearing itself, so the microphone is closed while it speaks (holding the cut-in key opens it). */
  turnTaking: boolean;
}

const SILENCE_MS = 14_000;

/** Replaceable parts, so the engine can be tried without a microphone and a voice (tests). */
export interface EngineParts {
  ears?: EarsLike;
  speaker?: SpeechOut;
}

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
  /** Said once when a turn of an open-weights call had to be served by Meta's hosted model. */
  private openNotice = '';
  /** Said once when the character seems to hear itself through the speakers. */
  private echoNotice = '';
  private echo = new EchoWatch();
  /** When the character last began a spoken line, for telling its echo from a person interrupting. */
  private speechStartedAt = 0;
  private lastLatencyMs?: number;
  private muted = false;
  /** Echo was suspected: the microphone is closed while the character speaks (see micClosedForTurnTaking). */
  private turnTaking = false;
  /** The user holds the cut-in key, so the microphone is open even while the character speaks. */
  private cuttingIn = false;
  private reopenTimer: number | undefined;
  /** Watches how long the user has been talking without a break, so a long monologue is cut in on at a breath. */
  private rambleGate: CutInGate;
  /** What the recogniser had heard of the current stretch of speech when the character cut in (its running text still starts with it). */
  private usedByCutIn = '';
  private cutInTimer: number | undefined;
  /** What was used by a cut-in is forgotten after a while even if the recogniser never ends that stretch of speech. */
  private usedExpiry: number | undefined;
  /** The character cut in and has not finished its line: the user's continued talking cannot cancel it at once. */
  private cutInPending = false;

  private ears: EarsLike;
  private speaker: SpeechOut;
  private abort: AbortController | null = null;
  private silenceTimer: number | undefined;
  private tick: number | undefined;
  private pendingFinal: BotReply | null = null;
  private sentenceBuf = '';
  private userStoppedAt = 0;
  /** When the character last stopped speaking, for the echo tail. */
  private botQuietAt = 0;
  private turnId = 0;
  private lang: Lang;
  /** Name of the voice the character speaks with (empty when the browser has none). */
  voiceName = '';

  constructor(
    private config: SessionConfig,
    private session: string,
    private onChange: (s: CallSnapshot) => void,
    private screenContext: () => string | undefined = () => undefined,
    parts: EngineParts = {},
  ) {
    this.lang = langOf(config);
    this.rambleGate = new CutInGate(CUT_IN[config.level]);
    if (parts.speaker) this.speaker = this.useSpeaker(parts.speaker);
    else {
      // A browser may have no voice of the right gender (Windows ships a single Polish voice): shift the pitch instead.
      const pick = pickVoice(config.persona.gender, this.lang, config.variant);
      this.voiceName = pick.voice?.name ?? '';
      this.speaker = this.useSpeaker(new Speaker(pick.voice, this.lang, pitchFor(pick.matched, config.persona.gender)));
    }
    this.ears = this.wireEars(parts.ears ?? new MetaEars(session, this.lang), !parts.ears);
  }

  private useSpeaker<S extends SpeechOut>(speaker: S): S {
    speaker.onIdle = () => this.onSpeechIdle();
    speaker.onStart = () => {
      this.speechStartedAt = Date.now();
      if (this.userStoppedAt) this.lastLatencyMs = Date.now() - this.userStoppedAt;
      this.set('speaking');
    };
    return speaker;
  }

  /** Muse Voice Transcribe is the ears; if it cannot start, fall back to the browser's recognizer. */
  private wireEars(ears: EarsLike, canFallBack: boolean): EarsLike {
    ears.onInterim = (t) => this.onInterim(t);
    ears.onFinal = (t) => this.onFinal(t);
    ears.onError = (m, fatal) => {
      if (fatal && canFallBack && this.state !== 'ended') {
        this.ears.stop();
        this.ears = this.wireEars(new Ears(this.lang), false);
        this.ears.setMuted?.(this.muted);
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
    void this.botTurn();
  }

  hangUp() {
    this.finish('user');
  }

  /** Mutes or unmutes the microphone. Whatever was being heard is dropped, and the character stops waiting for an answer. */
  setMuted(muted: boolean) {
    if (this.state === 'ended' || muted === this.muted) return;
    this.muted = muted;
    this.ears.setMuted?.(muted);
    this.applyEars();
    if (muted) {
      this.liveUser = '';
      this.usedByCutIn = '';
      this.rambleGate.reset();
      window.clearTimeout(this.silenceTimer);
      window.clearTimeout(this.cutInTimer);
    } else if (this.state === 'listening') this.armSilence();
    this.emit();
  }

  /**
   * Taking turns: while the character speaks the microphone is closed, and it opens again a moment after the line ends
   * (its last words are still coming back through a mixer). The user's own mute always wins.
   */
  private applyEars() {
    if (!this.turnTaking || this.state === 'ended') return;
    window.clearTimeout(this.reopenTimer);
    if (micClosedForTurnTaking(this.state, true, this.cuttingIn)) this.ears.setMuted?.(true);
    else this.reopenTimer = window.setTimeout(() => this.ears.setMuted?.(this.muted), this.state === 'speaking' ? 0 : TURN_TAKING_TAIL_MS);
  }

  /** The cut-in key is held (true) or let go (false): while taking turns, holding it lets the user talk over the character. */
  cutIn(on: boolean) {
    if (this.cuttingIn === on) return;
    this.cuttingIn = on;
    this.applyEars();
  }

  get takingTurns(): boolean {
    return this.turnTaking;
  }

  /** Text input fallback (also used by tests). */
  sendText(text: string) {
    this.onFinal(text, true);
  }

  get history(): Turn[] {
    return this.turns;
  }

  private now() {
    return Date.now() - this.startedAt;
  }

  private set(state: CallState) {
    if (this.state === 'ended') return;
    if (this.state === 'speaking' && state !== 'speaking') this.botQuietAt = Date.now();
    if (state === 'listening') this.cutInPending = false;
    this.state = state;
    this.applyEars();
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
      error: [this.error, this.openNotice, this.echoNotice].filter(Boolean).join(' ') || undefined,
      lastLatencyMs: this.lastLatencyMs,
      muted: this.muted,
      turnTaking: this.turnTaking,
    });
  }

  // ---- hearing -----------------------------------------------------------

  private botText() {
    return this.liveBot || this.turns.findLast((t) => t.role === 'bot')?.text || '';
  }

  private onInterim(heard: string) {
    if (this.state === 'ended' || this.muted) return;
    // After the character cut in, the recogniser's running text still starts with what was already used.
    const text = this.usedByCutIn ? afterCutIn(heard, this.usedByCutIn, this.lang) : heard;
    if (!text) return;
    window.clearTimeout(this.silenceTimer);
    this.liveUser = text;
    this.emit();
    if (this.state === 'listening') {
      // A long stretch of talking: at the next breath (no new words for a moment) the character cuts in.
      this.rambleGate.heard(text, Date.now());
      window.clearTimeout(this.cutInTimer);
      this.cutInTimer = window.setTimeout(() => this.cutInOnUser(), CUT_IN_PAUSE_MS);
    }
    // Barge-in: the user talks over the character. Echo of the character's own voice is filtered out.
    if ((this.state === 'speaking' || this.state === 'thinking') && !this.inCutInGrace() && novelWords(text, this.botText(), this.lang).length >= MIN_BARGE_WORDS) {
      this.noteBargeIn();
      this.interruptBot();
    }
  }

  /** A barge-in right after the character began a line is as likely its echo as a person: after two, say so once. */
  private noteBargeIn() {
    if (this.state === 'speaking') this.echo.bargeIn(Date.now() - this.speechStartedAt);
    this.checkEcho();
  }

  private checkEcho() {
    if (this.echoNotice || !this.echo.suspected) return;
    this.echoNotice = translate(this.lang, 'echoHint');
    // The fix that does not depend on the user's setup: stop listening while the character talks.
    this.turnTaking = true;
    this.applyEars();
    this.emit();
  }

  /**
   * The character cuts in on a monologue at a breath: what the user has said so far becomes their turn (marked as cut
   * off), the recogniser's running text is remembered so that what it reports next is not counted twice, and the character
   * answers with one short interrupting line.
   */
  private cutInOnUser() {
    if (this.state !== 'listening' || this.muted || !this.rambleGate.due(Date.now())) return;
    const said = this.liveUser.trim();
    if (!said) return;
    this.usedByCutIn = `${this.usedByCutIn} ${said}`.trim();
    window.clearTimeout(this.usedExpiry);
    this.usedExpiry = window.setTimeout(() => (this.usedByCutIn = ''), 25_000);
    this.rambleGate.reset();
    this.liveUser = '';
    this.cutInPending = true;
    this.userStoppedAt = Date.now();
    this.turns.push({ role: 'user', text: `${said} —`, at: this.now() });
    this.emit();
    void this.botTurn(simNote('rambling', this.lang));
  }

  /** Just after a cut-in the character's line (still being written, or just begun) is not cancelled by the user talking on. */
  private inCutInGrace(): boolean {
    if (!this.cutInPending) return false;
    if (this.state === 'thinking') return true;
    return this.state === 'speaking' && Date.now() - this.speechStartedAt < CUT_IN_GRACE_MS;
  }

  private onFinal(text: string, typed = false) {
    if (this.state === 'ended' || (this.muted && !typed)) return;
    if (!typed) {
      window.clearTimeout(this.cutInTimer);
      this.rambleGate.reset();
      if (this.usedByCutIn) {
        // the end of the stretch the character cut in on: only what was said after the cut-in is new
        const rest = afterCutIn(text, this.usedByCutIn, this.lang).trim();
        this.usedByCutIn = '';
        if (!rest) {
          this.liveUser = '';
          return;
        }
        text = rest;
      }
    }
    this.liveUser = '';
    // the character's own voice coming back (while it speaks, or the tail of its line right after): not an answer
    if (isBotEcho(this.state, Date.now() - this.botQuietAt, text, this.botText(), this.lang)) {
      this.echo.filtered();
      this.checkEcho();
      return;
    }
    if (this.state === 'speaking' || this.state === 'thinking') {
      this.noteBargeIn();
      this.interruptBot();
    }
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
    if (this.config.provider === 'open' && reply.servedBy === 'meta' && !this.openNotice) this.openNotice = translate(this.lang, 'openFellBack');
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
      if (this.state !== 'listening' || this.muted) return;
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
    this.ears.stop();
    window.clearTimeout(this.silenceTimer);
    window.clearTimeout(this.reopenTimer);
    window.clearTimeout(this.cutInTimer);
    window.clearTimeout(this.usedExpiry);
    window.clearInterval(this.tick);
    this.endReason = reason;
    this.state = 'ended';
    this.emit();
  }

  dispose() {
    this.finish(this.endReason ?? 'user');
  }
}
