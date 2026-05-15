import { LOCALES, useI18n } from '../i18n/I18nProvider';

/**
 * App-level settings panel. Hosts the language picker (and is the
 * natural home for any future cross-cutting UI preferences — theme,
 * units, etc. — that aren't tied to a specific log or saw).
 *
 * Visually mirrors `SettingsForm` so the two read as siblings: a
 * labelled control with a short hint underneath. The intro line
 * makes the panel's scope explicit ("not any specific log or saw")
 * so users don't go hunting here for kerf or species.
 *
 * The picker writes through `setLocale` from `useI18n()`, which
 * persists to localStorage (`sawmill.locale.v1`) and updates
 * `<html lang="…">`. Display labels for each locale come from the
 * `LOCALES` table in `i18n/strings.ts` so flags + native-language
 * names live with the rest of the i18n data.
 */
export function AppSettingsForm() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">{t('panel.app.intro')}</p>
      <label className="block text-sm">
        <span className="text-stone-600">{t('lang.label')}</span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
          aria-label={t('lang.label')}
          className="mt-1 block w-full rounded-md border-stone-300 bg-stone-50 px-2 py-1.5 border focus:border-forest-500 focus:ring-forest-500"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
