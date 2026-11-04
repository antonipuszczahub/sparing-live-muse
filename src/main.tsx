import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './themes.css';
import { App } from './App.tsx';

const root = createRoot(document.getElementById('root')!);
const fixture = import.meta.env.DEV ? new URLSearchParams(location.search).get('fx') : null;

if (fixture) {
  void import('./dev/fixtures.tsx').then(({ FixtureApp }) => root.render(<FixtureApp name={fixture} />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
