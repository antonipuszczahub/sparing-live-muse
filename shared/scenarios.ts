import { LEVELS_PL, SCENARIOS_PL } from './scenarios.pl.ts';
import type { Lang, Level, ScenarioId } from './types.ts';

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  tagline: string;
  /** Placeholder for the "what are you selling / defending" field. */
  topicLabel: string;
  topicExample: string;
  /** Hint under "rehearse with a real company". */
  twinExample: string;
  /** What the user is doing, from the character's point of view. */
  situation: string;
  /** What the character does first when the call connects. */
  opening: string;
  /** Hint for the auditor about what "winning" looks like here. */
  winCondition: string;
  /** Can the user share a screen (slides, code, portfolio) in this scenario? */
  screenHint: string;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  sales: {
    id: 'sales',
    title: 'Sales call',
    tagline: 'Cold or warm call to a business owner who has heard it all.',
    topicLabel: 'What are you selling?',
    topicExample: 'A redesign of their website, 3,000 USD, two weeks',
    twinExample: 'e.g. basecamp.com, or the website of the company you will call',
    situation: 'The user is calling you to sell something. You did not ask for this call.',
    opening: 'You pick up the phone, busy, and say who is speaking. You do not know why they are calling.',
    winCondition: 'Earn a concrete next step (a meeting or a trial), not a polite brush-off.',
    screenHint: 'Share your portfolio or offer page and the buyer will react to it.',
  },
  defense: {
    id: 'defense',
    title: 'Project defense',
    tagline: 'Defend a thesis, capstone or technical project in front of a committee.',
    topicLabel: 'What are you defending?',
    topicExample: 'A mobile app that predicts bus delays, engineering thesis',
    twinExample: '',
    situation: 'The user is defending their work in front of you. You have read it and have questions.',
    opening: 'You welcome the candidate, glance at the notes, and ask them to begin with what they consider the most important result.',
    winCondition: 'Defend decisions with reasons, admit real limits, and never bluff.',
    screenHint: 'Share your slides or your code. The examiner will ask about specific lines and slides.',
  },
  salary: {
    id: 'salary',
    title: 'Salary negotiation',
    tagline: 'Ask for a raise or negotiate an offer with a manager who has a budget.',
    topicLabel: 'What are you asking for?',
    topicExample: 'A 15% raise after two years as a backend developer',
    twinExample: 'e.g. the company you work for or are joining',
    situation: 'The user booked this meeting to ask you for money.',
    opening: 'You greet them and say you have a few minutes; you ask what they wanted to talk about.',
    winCondition: 'Leave with a number or a dated, written commitment, without an ultimatum.',
    screenHint: 'Share your list of achievements and the manager will cross-examine it.',
  },
  pitch: {
    id: 'pitch',
    title: 'Investor pitch',
    tagline: 'Three minutes to convince someone who writes checks for a living.',
    topicLabel: 'What is your startup?',
    topicExample: 'B2B tool that automates invoice reconciliation for logistics firms',
    twinExample: 'e.g. the fund you are pitching, such as ycombinator.com',
    situation: 'The user is pitching you for seed funding. You get pitched every day.',
    opening: 'You say you have about ten minutes and ask them to start with the problem.',
    winCondition: 'Get a second meeting by showing real customers, real money and a credible team.',
    screenHint: 'Share your deck and the investor will go straight to the weakest slide.',
  },
};

export interface LevelDef {
  level: Level;
  name: string;
  blurb: string;
  /** Behaviour rules appended to the character prompt. */
  rules: string[];
  /** Maximum words the character may speak per turn. */
  maxWords: number;
}

export const LEVELS: Record<Level, LevelDef> = {
  1: {
    level: 1,
    name: 'Friendly',
    blurb: 'Patient. Gives you room, raises small objections.',
    maxWords: 45,
    rules: [
      'You are patient and let the user finish their point.',
      'You raise at most one mild objection per turn and soften it.',
      'You never interrupt and you never hang up.',
    ],
  },
  2: {
    level: 2,
    name: 'Realistic',
    blurb: 'A normal person on a normal day. Skeptical until convinced.',
    maxWords: 40,
    rules: [
      'You are skeptical by default and move only when the user gives a concrete reason.',
      'You raise real objections and ask for specifics. Vague answers get a short, direct follow-up.',
      'You hang up only after repeated rudeness or a clearly pointless call.',
    ],
  },
  3: {
    level: 3,
    name: 'Tough',
    blurb: 'Short on time, blunt, interrupts rambling.',
    maxWords: 32,
    rules: [
      'You are short on time. Rambling gets cut off with a one-line reaction.',
      'You challenge claims with numbers and ask about the downside.',
      'If the user is vague three times in a row, you end the call politely but firmly.',
    ],
  },
  4: {
    level: 4,
    name: 'Brutal',
    blurb: 'A bad day. Cuts in, pushes back hard, may hang up.',
    maxWords: 26,
    rules: [
      'You are having a bad day and it shows: clipped sentences, little patience.',
      'You interrupt weak arguments and test whether the user holds under pressure.',
      'You respect only real substance. Filler, flattery or pressure tactics make you end the call.',
      'You still stay human and fair: a strong, specific answer visibly changes your attitude.',
    ],
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

/** The scenario in the language of the call. */
export const scenarioDef = (id: ScenarioId, lang: Lang = 'en'): ScenarioDef => (lang === 'pl' ? SCENARIOS_PL : SCENARIOS)[id];

/** The difficulty level in the language of the call. */
export const levelDef = (level: Level, lang: Lang = 'en'): LevelDef => (lang === 'pl' ? LEVELS_PL : LEVELS)[level];
