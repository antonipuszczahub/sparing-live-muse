import { useState } from 'react';
import { t } from '../i18n/index.ts';
import { getPtt, setPtt } from '../lib/ptt.ts';
import { Switch } from './Switch.tsx';
import styles from './VoicePicker.module.css';

/** Off by default. When on, the call listens only while Space (or the microphone button) is held. */
export function PushToTalk() {
  const [on, setOn] = useState(getPtt);
  return (
    <section className={styles.wrap}>
      <Switch
        checked={on}
        onChange={(v) => {
          setPtt(v);
          setOn(v);
        }}
      >
        {t('pttTitle')}
      </Switch>
      <p className={styles.small}>{t('pttNote')}</p>
    </section>
  );
}
