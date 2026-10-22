// App translations. UI strings live in the dictionaries next to this file, never in screens.
import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { interpolate, pluralCategory, type Params } from '@/lib/translate';

import { de } from './de';
import { en, type Dictionary, type TranslationKey } from './en';
import { es } from './es';
import { fr } from './fr';

/** App languages, labelled in their own language. */
export const LANGUAGES = {
  en: { label: 'English', dict: en },
  fr: { label: 'Français', dict: fr },
  es: { label: 'Español', dict: es },
  de: { label: 'Deutsch', dict: de },
} satisfies Record<string, { label: string; dict: Dictionary }>;

export type Lang = keyof typeof LANGUAGES;
export type LanguagePref = Lang | 'system';

/** Languages offered for AI-generated cards: `value` goes into the prompt, `label` is shown. */
export const CARD_LANGUAGES = [
  { value: 'English', label: 'English', lang: 'en' },
  { value: 'French', label: 'Français', lang: 'fr' },
  { value: 'Spanish', label: 'Español', lang: 'es' },
  { value: 'German', label: 'Deutsch', lang: 'de' },
  { value: 'Italian', label: 'Italiano' },
  { value: 'Portuguese', label: 'Português' },
  { value: 'Dutch', label: 'Nederlands' },
  { value: 'Polish', label: 'Polski' },
  { value: 'Turkish', label: 'Türkçe' },
  { value: 'Russian', label: 'Русский' },
  { value: 'Arabic', label: 'العربية' },
  { value: 'Chinese', label: '中文' },
  { value: 'Japanese', label: '日本語' },
  { value: 'Korean', label: '한국어' },
];

const STORAGE_KEY = 'language';
const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in LANGUAGES;

function resolve(pref: LanguagePref): Lang {
  if (pref !== 'system') return pref;
  const device = getLocales()[0]?.languageCode;
  return isLang(device) ? device : 'en';
}

function readPref(): LanguagePref {
  const stored = Storage.getItemSync(STORAGE_KEY);
  return isLang(stored) ? stored : 'system';
}

type PluralBase = TranslationKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

const Ctx = createContext<{ pref: LanguagePref; setPref: (p: LanguagePref) => void } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LanguagePref>(readPref);
  const setPref = (p: LanguagePref) => {
    Storage.setItemSync(STORAGE_KEY, p);
    setPrefState(p);
  };
  return <Ctx.Provider value={{ pref, setPref }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  const lang = resolve(ctx.pref);
  const dict = LANGUAGES[lang].dict;
  const t = (key: TranslationKey, params?: Params) => interpolate(dict[key], params);
  const tp = (key: PluralBase, count: number, params?: Params) =>
    t(`${key}_${pluralCategory(lang, count)}` as TranslationKey, { count, ...params });
  return { t, tp, lang, pref: ctx.pref, setPref: ctx.setPref };
}

export type Translator = Pick<ReturnType<typeof useI18n>, 't' | 'tp'>;
export type { TranslationKey };
