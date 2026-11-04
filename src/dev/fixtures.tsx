/**
 * Development only: the call, review and research screens with made-up data, so the interface can be
 * looked at without spending model calls. Open /?fx=call, call-hostile, call-won, report, report-wait, report-error, twin or twin-ready (add &note=echo to a call to see the headphones hint, &long=1 to a report to see a long summary).
 * main.tsx loads this file only in the dev server; it is not part of the production build.
 */
import { useRef } from 'react';
import type { Mood, TwinProfile, Turn } from '../../shared/types.ts';
import { Backdrop } from '../components/Backdrop.tsx';
import type { CallSnapshot } from '../engine/CallEngine.ts';
import { getLang, setLang, translate } from '../i18n/index.ts';
import { useMoodTheme } from '../lib/useMoodTheme.ts';
import { SAMPLE_TRACE, sampleConfig, sampleResult, sampleTurns } from '../sample/data.ts';
import { CallView } from '../screens/CallView.tsx';
import { ReportView } from '../screens/ReportView.tsx';
import { TwinView } from '../screens/TwinView.tsx';

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

function snapshot(turns: Turn[], mood: Mood, error?: string): CallSnapshot {
  return {
    error,
    state: 'listening',
    turns: turns.slice(0, 5),
    liveBot: '',
    liveUser: getLang() === 'pl' ? 'Przechodzi na plan roczny, jeśli gabinet osiągnie' : 'It converts to a yearly plan if the clinic hits',
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
  const config = sampleConfig(getLang());
  const turns = sampleTurns(getLang());
  const result = sampleResult(getLang());
  const mood = (Number(params.get('mood')) || (name === 'call-hostile' ? 1 : name === 'call-won' ? 5 : 2)) as Mood;
  const selfView = useRef<HTMLVideoElement>(null);
  useMoodTheme(name.startsWith('call') ? mood : null);

  let screen;
  if (name.startsWith('call')) {
    screen = (
      <CallView
        session="" /* no session: the portrait is the photograph, nothing is requested */
        config={config}
        snap={snapshot(turns, mood, params.get('note') === 'echo' ? translate(getLang(), 'echoHint') : undefined)}
        voiceName="Microsoft Aria Online (Natural)"
        camOn={false}
        face={null}
        selfView={selfView}
        sharing
        seen={getLang() === 'pl' ? 'Slajd 4 mówi, że rynek to 40 mld dolarów. Na tym slajdzie nie ma ani słowa o klientach.' : 'Slide 4 says the market is $40B. There is no mention of customers on this slide.'}
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
        result={name === 'report-wait' || name === 'report-error' ? null : params.get('long') === '1' ? { ...result, summary: `${result.summary} ${result.summary} ${result.summary}` } : result}
        trace={SAMPLE_TRACE}
        error={name === 'report-error' ? 'The review could not be made: the model did not answer.' : ''}
        secs={7}
        onAgain={() => undefined}
        onRedial={() => undefined}
        onRetry={() => undefined}
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
