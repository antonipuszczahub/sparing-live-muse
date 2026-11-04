import { useState } from 'react';
import { t } from '../i18n/index.ts';
import { applyTheme, initialTheme, THEMES, type Theme } from '../lib/theme.ts';
import ui from './ui.module.css';
import styles from './VoicePicker.module.css';

const NAME = { classic: 'themeClassic', maison: 'themeMaison', atelier: 'themeAtelier', galerie: 'themeGalerie' } as const satisfies Record<Theme, string>;

/** The look of the whole app: the same screens in a different palette, face and shape. Remembered in this browser. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  return (
    <section className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.who}>{t('themeTitle')}</span>
        <div role="group" aria-label={t('themeTitle')} className={ui.seg} style={{ flexWrap: 'wrap' }}>
          {THEMES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={theme === id}
              onClick={() => {
                applyTheme(id);
                setTheme(id);
              }}
            >
              {t(NAME[id])}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
