/**
 * Development only: the call, review and research screens with made-up data, so the interface can be
 * looked at without spending model calls. Open /?fx=call, call-hostile, call-won, report, report-wait, twin or twin-ready (add &note=echo to a call to see the headphones hint).
 * main.tsx loads this file only in the dev server; it is not part of the production build.
 */
import { useRef } from 'react';
import type { AuditResult } from '../../shared/audit.ts';
import type { Mood, SessionConfig, TwinProfile, Turn } from '../../shared/types.ts';
import { Backdrop } from '../components/Backdrop.tsx';
import type { CallSnapshot } from '../engine/CallEngine.ts';
import { getLang, setLang, translate } from '../i18n/index.ts';
import { useMoodTheme } from '../lib/useMoodTheme.ts';
import { CallView } from '../screens/CallView.tsx';
import { ReportView } from '../screens/ReportView.tsx';
import { TwinView } from '../screens/TwinView.tsx';

const config: SessionConfig = {
  scenario: 'pitch',
  level: 2,
  topic: 'A scheduling tool for dental clinics',
  persona: { name: 'Dana Whitfield', role: 'Partner at a seed fund', gender: 'f', bio: 'Writes small checks, remembers every number.' },
  variant: 3,
  provider: 'open',
  lang: 'en',
};

const turns: Turn[] = [
  { role: 'bot', text: 'Three minutes, you said. I have heard a lot about the market and nothing about who pays you.', thought: 'Another market slide. Show me one invoice.', mood: 3, at: 12000 },
  { role: 'user', text: 'Fair. Two dental chains are our first customers, and one already paid for a pilot.', at: 31000 },
  { role: 'bot', text: 'How much, and for how long? A pilot can mean anything from a free trial to a real contract.', thought: 'If it is paid, I will lean in. If it is free, this is a hobby.', mood: 2, at: 41000 },
  { role: 'user', text: 'Eight hundred a month per clinic, six months, signed in September.', at: 62000 },
  { role: 'bot', text: 'Six months is a trial, not a business. What happens when it ends?', thought: 'Real money, but six months proves nothing. Make me believe in year two.', mood: 3, at: 78000 },
  { role: 'user', text: 'We think the market is, uh, you know, really big, like forty billion, and we are, um, just getting started.', at: 101000 },
  { role: 'bot', text: 'I asked about renewal, not the market.', thought: 'Four fillers in one breath. I am losing interest.', mood: 2, at: 118000 },
  { role: 'user', text: 'Right. Both clinics renewed for another year, and a third signs next month.', at: 139000 },
  { role: 'bot', text: 'Now that is a sentence I can write down. Send me the contract terms.', thought: 'There it is. A number, a renewal, a next step.', mood: 4, at: 152000 },
];

const result: AuditResult = {
  score: 58,
  outcome: 'partial',
  verdict: 'You had a paying customer and kept it hidden for ninety seconds.',
  summary: 'Dana opened cold and warmed up only after you named the pilot. The pitch lost ground whenever you reached for the size of the market instead of a number you could prove.',
  skills: { clarity: 7, listening: 4, objections: 5, specificity: 3, composure: 6 },
  moments: [
    { turn: 1, kind: 'strength', what: 'You answered with a fact, not a claim.', why: 'A paid pilot says who pays you in one sentence. Dana’s attitude moved from cold to neutral right after it.' },
    {
      turn: 5,
      kind: 'mistake',
      what: 'Dana asked about renewal and you gave her a market size.',
      why: 'Four filler words in one breath, and the one number she wanted never came.',
      betterLine: 'Eight hundred dollars a month per clinic. Two clinics today, and a third signs next month.',
    },
  ],
  nextFocus: ['Lead with the paying customer in your first ten seconds.', 'State the price before you are asked.', 'Answer in two sentences, then stop.'],
  weaknessTags: [],
};

const twin: TwinProfile = {
  company: 'Northwind Ventures',
  url: 'https://northwind.vc',
  buyerRole: 'Partner, healthcare software',
  buyerBio: 'Ex-operator who ran a clinic software company. Skeptical of anything that does not touch revenue within a quarter.',
  summary: 'A seed fund that writes first checks of $500k to $1.5M into vertical software, with a recent focus on dental and veterinary clinics.',
  customers: 'Seed-stage vertical software founders',
  vocabulary: ['renewal', 'payback period'],
  pains: ['Founders who talk market size instead of customers', 'Pilots that never convert into contracts'],
  objections: ['Why would a clinic switch from its current scheduler?', 'What happens to your margin when a chain negotiates?'],
  sources: ['https://northwind.vc/about', 'https://www.example.com/news/northwind-fund-ii'],
};

function snapshot(mood: Mood, error?: string): CallSnapshot {
  return {
    error,
    state: 'listening',
    turns: turns.slice(0, 5),
    liveBot: '',
    liveUser: 'It converts to a yearly plan if the clinic hits',
    mood,
    elapsedMs: 134000,
    muted: false,
    lastLatencyMs: 1100,
  };
}

export function FixtureApp({ name }: { name: string }) {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang');
  if (lang === 'pl' || lang === 'en') setLang(lang);
  const mood = (Number(params.get('mood')) || (name === 'call-hostile' ? 1 : name === 'call-won' ? 5 : 2)) as Mood;
  const selfView = useRef<HTMLVideoElement>(null);
  useMoodTheme(name.startsWith('call') ? mood : null);

  let screen;
  if (name.startsWith('call')) {
    screen = (
      <CallView
        session="fixture"
        config={config}
        snap={snapshot(mood, params.get('note') === 'echo' ? translate(getLang(), 'echoHint') : undefined)}
        voiceName="Microsoft Aria Online (Natural)"
        camOn={false}
        face={null}
        selfView={selfView}
        sharing
        seen="Slide 4 says the market is $40B. There is no mention of customers on this slide."
        typed=""
        canCamera
        canShare
        onTyped={() => undefined}
        onSend={() => undefined}
        onMute={() => undefined}
        onCamera={() => undefined}
        onShare={() => undefined}
        onHangUp={() => undefined}
      />
    );
  } else if (name.startsWith('report')) {
    screen = (
      <ReportView
        session="fixture"
        config={config}
        turns={turns}
        durationMs={192000}
        hungUp={false}
        camera={[]}
        result={name === 'report-wait' ? null : result}
        trace={[
          { kind: 'asr', model: 'muse-voice-transcribe-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: null, costUsd: 0.002 },
          { kind: 'character-turn', model: 'meta-models/muse-spark-open-1026', served: 'Open weights · Baseten', open: true, calls: 9, medianMs: 1480, costUsd: 0 },
          { kind: 'eye', model: 'muse-spark-1.3', served: 'Meta Model API', open: false, calls: 1, medianMs: 2700, costUsd: 0.003 },
          { kind: 'twin-research', model: 'muse-wonder-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 29800, costUsd: 0.16 },
          { kind: 'portrait', model: 'muse-image-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 8600, costUsd: 0.01 },
          { kind: 'portrait-edit', model: 'muse-image-1.0', served: 'Meta Model API', open: false, calls: 2, medianMs: 16100, costUsd: 0.02 },
          { kind: 'audit', model: 'muse-wonder-1.0', served: 'Meta Model API', open: false, calls: 1, medianMs: 13200, costUsd: 0.04 },
        ]}
        error=""
        secs={7}
        onAgain={() => undefined}
        onRedial={() => undefined}
      />
    );
  } else {
    screen = (
      <TwinView
        company="Northwind Ventures"
        steps={[
          { kind: 'search', text: 'Northwind Ventures seed fund portfolio' },
          { kind: 'open', text: 'northwind.vc/about' },
          { kind: 'note', text: 'They back vertical software and care about renewals.' },
        ]}
        twin={name === 'twin-ready' ? twin : null}
        error=""
        secs={9}
        onReady={() => undefined}
        onSkip={() => undefined}
      />
    );
  }
  return (
    <>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 2 }}>{screen}</div>
    </>
  );
}
