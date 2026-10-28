export type ScenarioId = 'sales' | 'defense' | 'salary' | 'pitch';
export type Level = 1 | 2 | 3 | 4;

export interface Persona {
  name: string;
  role: string;
  gender: 'm' | 'f';
  /** One-paragraph character sheet. */
  bio: string;
}

/** Profile of a real company, researched from the web by the twin agent. */
export interface TwinProfile {
  company: string;
  url: string;
  /** The person on the other side of the call at this company, e.g. "Head of Operations". */
  buyerRole: string;
  buyerBio: string;
  summary: string;
  customers: string;
  /** What this company currently struggles with, as visible from public sources. */
  pains: string[];
  /** Objections a buyer here would realistically raise. */
  objections: string[];
  vocabulary: string[];
  /** Sources the research agent actually read. */
  sources: string[];
}

export interface SessionConfig {
  scenario: ScenarioId;
  level: Level;
  /** What the user is selling / defending / asking for, in their words. */
  topic: string;
  persona: Persona;
  twin?: TwinProfile;
  /** Seed for today's variation (circumstance, mood, hidden agenda). */
  variant: number;
  /** Weak spots from earlier calls that this character should probe. */
  focus?: string[];
  /** Which weights run the character: Meta Model API (default) or open weights on Baseten. */
  provider?: 'meta' | 'open';
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface Turn {
  role: 'user' | 'bot';
  text: string;
  /** Hidden inner monologue of the character. Never spoken, shown in the replay. */
  thought?: string;
  mood?: Mood;
  /** ms since the start of the call. */
  at: number;
}

export interface BotReply {
  thought: string;
  mood: Mood;
  reply: string;
  hangup: boolean;
}
