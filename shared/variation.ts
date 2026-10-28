import { gendered } from './lang.ts';
import type { Lang, Persona, ScenarioId } from './types.ts';
import { POOLS_PL } from './variation.pl.ts';

/** Small deterministic PRNG so a call can be replayed from its seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)] as T;
}

const NAMES_EN = {
  m: ['Greg Holloway', 'Raj Patel', 'Tomas Rivera', 'Daniel Okafor', 'Marcus Lindqvist', 'Victor Hale', 'Sam Whitfield', 'Ahmed Karim'],
  f: ['Dana Whitfield', 'Priya Nair', 'Elena Moretti', 'Claire Okonkwo', 'Hannah Brandt', 'Maya Reyes', 'Ingrid Solberg', 'Leah Cohen'],
};

export interface RolePool {
  role: string;
  bios: string[];
}

/** Everything that varies from call to call, in one language. Polish text may carry {m|f} gender markers. */
export interface Pools {
  names: { m: string[]; f: string[] };
  roles: Record<ScenarioId, RolePool>;
  circumstances: Record<ScenarioId, string[]>;
  agendas: Record<ScenarioId, string[]>;
  moods: readonly string[];
  tics: readonly string[];
}

const ROLES_EN: Record<ScenarioId, RolePool> = {
  sales: {
    role: 'owner of a small company',
    bios: [
      'Runs a 12-person logistics company built over fifteen years. Burned twice by agencies that overpromised. Values straight answers and hates jargon.',
      'Owns three bakeries. Practical, always in a hurry, treats every unsolicited call as a threat to the morning.',
      'Founder of a local design studio. Proud, a little defensive about the work, suspicious that anyone selling here thinks the studio is behind the times.',
      'Runs the family hardware business after a parent retired. Numbers person; wants to know exactly what it costs and what it returns.',
    ],
  },
  defense: {
    role: 'thesis examiner',
    bios: [
      'Associate professor, twenty years on committees. Fair but allergic to hand-waving; asks the one question you hoped to avoid.',
      'Senior engineer from industry sitting on the committee. Cares whether it would survive production, not whether the slides are pretty.',
      'Young lecturer who read the whole thesis the night before and found three real problems in the methodology.',
      'Committee chair, tired, wants to finish on time but will not let a weak argument pass.',
    ],
  },
  salary: {
    role: 'your manager',
    bios: [
      'Engineering manager who likes you but has a fixed budget and a boss who watches every exception.',
      'Director who treats compensation as a pure numbers game and respects people who bring evidence.',
      'Founder-CEO of a growing startup; sentimental about loyalty, allergic to ultimatums.',
      'HR business partner, polite and immovable, always has a policy for everything.',
    ],
  },
  pitch: {
    role: 'seed-stage investor',
    bios: [
      'Partner at a small fund. Has seen 3,000 decks and can smell an inflated market size in one slide.',
      'Ex-founder turned angel. Asks about the team first and the product second.',
      'Operator-investor who only cares whether customers already pay and why they would not leave.',
      'Partner who got burned by the last two investments in this space and is openly skeptical.',
    ],
  },
};

const CIRCUMSTANCES_EN: Record<ScenarioId, string[]> = {
  sales: [
    'A delivery crisis is going on in the background and you keep half-watching your phone.',
    'It is end of month and cash is tight, so every cost sounds heavier than usual.',
    'You just got off a bad call with another vendor.',
    'Your best employee gave notice this morning.',
    'You are in a good mood, which makes you chatty, but you still will not sign anything today.',
  ],
  defense: [
    'This is your fourth defense of the day and your attention is thin.',
    'You skimmed the abstract only and will ask about it directly.',
    'You are sympathetic to the topic and therefore harder on the methodology.',
    'A colleague just challenged your own grading and you are in a pedantic mood.',
  ],
  salary: [
    'The company just announced a hiring freeze and you are nervous about budgets.',
    'Two other people are asking for raises this month.',
    'You had a great quarter and feel generous, but have no authority to approve anything alone.',
    'You are visibly distracted by an incident in production.',
  ],
  pitch: [
    'You have back-to-back pitches and have already forgotten the previous deck.',
    'The market this team is attacking has produced three failures in your portfolio.',
    'You are in a good mood and genuinely want to like this.',
    'Your partner meeting is in an hour and you need a reason to pass or push.',
  ],
};

const AGENDAS_EN: Record<ScenarioId, string[]> = {
  sales: [
    'You are secretly looking for a reason to say yes, but only if they make you feel safe on price.',
    'You will not decide today under any circumstances; you want to see whether they push anyway.',
    'You care more about who will pick up the phone when it breaks than about the feature list.',
    'You are testing whether they listen: you drop a concrete need early and see if it comes back.',
  ],
  defense: [
    'You want to see whether they know the limits of their own results.',
    'You will push on one weak chapter until they either defend it or concede.',
    'You are looking for evidence that they did the work themselves.',
  ],
  salary: [
    'You can get them maybe half of what they ask, but only if they give a reason beyond "I deserve it".',
    'You secretly agree they are underpaid, but need ammunition to take upstairs.',
    'You will deflect to next quarter unless pressed with specific results.',
  ],
  pitch: [
    'You will pass unless they show real, recurring customer money.',
    'You are weighing whether this founder can recruit; every answer is a signal about that.',
    'You will interrupt the first time you hear "huge market" without a number.',
  ],
};

const MOODS_EN = ['neutral and businesslike', 'a little impatient', 'warm but guarded', 'tired and terse', 'curious but skeptical'] as const;
const TICS_EN = [
  'says "look," before disagreeing',
  'asks short follow-up questions',
  'repeats the last two words back before answering',
  'sighs before bad news',
  'uses concrete numbers instead of adjectives',
] as const;

const POOLS_EN: Pools = {
  names: NAMES_EN,
  roles: ROLES_EN,
  circumstances: CIRCUMSTANCES_EN,
  agendas: AGENDAS_EN,
  moods: MOODS_EN,
  tics: TICS_EN,
};

const POOLS: Record<Lang, Pools> = { en: POOLS_EN, pl: POOLS_PL };

export interface Variant {
  persona: Persona;
  circumstance: string;
  agenda: string;
  mood: string;
  tic: string;
}

/** The same seed gives the same character and day in a language; the draw order does not depend on the language. */
export function rollVariant(scenario: ScenarioId, seed: number, lang: Lang = 'en'): Variant {
  const r = rng(seed);
  const pools = POOLS[lang];
  const gender: 'm' | 'f' = r() < 0.5 ? 'm' : 'f';
  const pool = pools.roles[scenario];
  const g = (text: string) => (lang === 'pl' ? gendered(text, gender) : text);
  return {
    persona: { name: pick(r, pools.names[gender]), role: g(pool.role), gender, bio: g(pick(r, pool.bios)) },
    circumstance: g(pick(r, pools.circumstances[scenario])),
    agenda: g(pick(r, pools.agendas[scenario])),
    mood: g(pick(r, pools.moods)),
    tic: g(pick(r, pools.tics)),
  };
}
